<?php

declare(strict_types=1);

namespace Ecollect\Modules;

use Ecollect\Config;
use Ecollect\Types\SavedCard;
use Ecollect\Utils\ErrorMapper;
use Ecollect\Utils\HttpClient;
use Ecollect\Utils\Validators;

/**
 * Handles tokenisation commands and saved card management.
 */
class TokensModule
{
    /** @var Config */
    private $config;

    /** @var HttpClient */
    private $http;

    /** @var SessionModule */
    private $session;

    public function __construct(Config $config, HttpClient $http, SessionModule $session)
    {
        $this->config  = $config;
        $this->http    = $http;
        $this->session = $session;
    }

    /**
     * Save a card token persistently (SAVE command).
     *
     * @param  array<string, mixed> $cardData
     * @return SavedCard
     */
    public function save(array $cardData): SavedCard
    {
        Validators::validateCardNumber($cardData['card_number'] ?? '');
        Validators::validateExpirationDate($cardData['expiration_date'] ?? '');
        return $this->command('SAVE', $this->buildCardTokenInfoArray($cardData));
    }

    /**
     * Get a temporary token without saving (GET command).
     *
     * @param  array<string, mixed> $cardData
     * @return SavedCard
     */
    public function get(array $cardData): SavedCard
    {
        Validators::validateCardNumber($cardData['card_number'] ?? '');
        Validators::validateExpirationDate($cardData['expiration_date'] ?? '');
        return $this->command('GET', $this->buildCardTokenInfoArray($cardData));
    }

    /**
     * Get a hold token for pre-authorization (HOLD command).
     *
     * @param  array<string, mixed> $cardData
     * @return SavedCard
     */
    public function hold(array $cardData): SavedCard
    {
        Validators::validateCardNumber($cardData['card_number'] ?? '');
        Validators::validateExpirationDate($cardData['expiration_date'] ?? '');
        return $this->command('HOLD', $this->buildCardTokenInfoArray($cardData));
    }

    /**
     * Delete a saved card (REMOVE command).
     *
     * @param  string $tokenId
     * @param  string $email
     * @param  string $cardHolderId
     * @return void
     */
    public function delete(string $tokenId, string $email, string $cardHolderId): void
    {
        $this->command('REMOVE', [
            ['AttributeCode' => 1,  'AttributeDesc' => 'TokenId',     'AttributeValue' => $tokenId],
            ['AttributeCode' => 6,  'AttributeDesc' => 'Usermail',    'AttributeValue' => $email],
            ['AttributeCode' => 19, 'AttributeDesc' => 'CardHolderId', 'AttributeValue' => $cardHolderId],
        ]);
    }

    /**
     * Update expiration date of a saved card (UPDATE command).
     *
     * @param  string      $tokenId
     * @param  string      $newExpiry MM/YYYY
     * @param  string|null $cardHolderId
     * @return SavedCard
     */
    public function update(string $tokenId, string $newExpiry, ?string $cardHolderId = null): SavedCard
    {
        Validators::validateExpirationDate($newExpiry);

        $items = [
            ['AttributeCode' => 1, 'AttributeDesc' => 'TokenId',        'AttributeValue' => $tokenId],
            ['AttributeCode' => 4, 'AttributeDesc' => 'ExpirationDate', 'AttributeValue' => $newExpiry],
        ];

        if ($cardHolderId) {
            $items[] = ['AttributeCode' => 19, 'AttributeDesc' => 'CardHolderId', 'AttributeValue' => $cardHolderId];
        }

        return $this->command('UPDATE', $items);
    }

    /**
     * List saved cards for a user (queryToken).
     *
     * @param  string         $email
     * @param  string         $cardHolderId
     * @return SavedCard[]
     */
    public function list(string $email, string $cardHolderId): array
    {
        $url          = $this->config->baseUrl() . '/queryToken';
        $sessionToken = $this->session->getActive();

        $body = [
            'EntityCode'     => $this->config->etyCode,
            'SessionToken'   => $sessionToken,
            'TokenInfoArray' => [
                ['AttributeCode' => 6,  'AttributeDesc' => 'Usermail',    'AttributeValue' => $email],
                ['AttributeCode' => 19, 'AttributeDesc' => 'CardHolderId', 'AttributeValue' => $cardHolderId],
            ],
        ];

        $res = $this->http->post($url, $body);

        if (($res['ReturnCode'] ?? '') === 'NO_RECORDS') {
            return [];
        }

        if (($res['ReturnCode'] ?? '') !== 'SUCCESS') {
            throw ErrorMapper::map($res['ReturnCode'] ?? 'FAIL_SYSTEM');
        }

        $cards = [];
        foreach (($res['TokenArray'] ?? []) as $record) {
            $arr      = $record['TokenInfoArray'] ?? [];
            $findAttr = function (int $code) use ($arr): ?string {
                foreach ($arr as $item) {
                    if ((int)($item['AttributeCode'] ?? -1) === $code) {
                        return $item['AttributeValue'] ?? null;
                    }
                }
                return null;
            };

            $cards[] = new SavedCard([
                'token_id'       => $findAttr(1) ?? '',
                'masked_card'    => $findAttr(12),
                'last4'          => $findAttr(11),
                'bin4'           => $findAttr(30),
                'payment_system' => $findAttr(2),
                'fi_code'        => $findAttr(9),
                'fi_name'        => $findAttr(10),
                'brand_image_url' => $findAttr(13),
                'email'          => $findAttr(6),
                'customer_id'    => $findAttr(100),
                'token_status'   => $record['TokenStatus'] ?? null,
                'lifetime_secs'  => $record['LifetimeSecs'] ?? null,
                'requires_otp'   => $findAttr(25) !== null,
            ]);
        }

        return $cards;
    }

    // -------------------------------------------------------------------------
    // Private helpers
    // -------------------------------------------------------------------------

    /**
     * @param  string                             $command
     * @param  array<int, array<string, mixed>>   $tokenInfoArray
     * @return SavedCard
     */
    private function command(string $command, array $tokenInfoArray): SavedCard
    {
        $url          = $this->config->baseUrl() . '/tokenCommand';
        $sessionToken = $this->session->getActive();

        $body = [
            'EntityCode'     => $this->config->etyCode,
            'SessionToken'   => $sessionToken,
            'Command'        => $command,
            'TokenInfoArray' => $tokenInfoArray,
        ];

        $res = $this->http->post($url, $body);

        if (($res['ReturnCode'] ?? '') === 'FAIL_APIEXPIREDSESSION') {
            $this->session->invalidate();
            $body['SessionToken'] = $this->session->getActive();
            $res                  = $this->http->post($url, $body);

            if (
                ($res['ReturnCode'] ?? '') !== 'SUCCESS'
                && ($res['ReturnCode'] ?? '') !== 'SUCCESS_ALREADY_CREATED'
            ) {
                throw ErrorMapper::map($res['ReturnCode'] ?? 'FAIL_SYSTEM');
            }
        } elseif (
            ($res['ReturnCode'] ?? '') !== 'SUCCESS'
            && ($res['ReturnCode'] ?? '') !== 'SUCCESS_ALREADY_CREATED'
        ) {
            throw ErrorMapper::map($res['ReturnCode'] ?? 'FAIL_SYSTEM');
        }

        return $this->mapTokenResponse($res);
    }

    /**
     * @param  array<string, mixed>               $cardData
     * @return array<int, array<string, mixed>>
     */
    private function buildCardTokenInfoArray(array $cardData): array
    {
        $items = [];

        $add = function (int $code, string $desc, $value) use (&$items): void {
            if ($value !== null && $value !== '') {
                $items[] = ['AttributeCode' => $code, 'AttributeDesc' => $desc, 'AttributeValue' => (string)$value];
            }
        };

        $add(0,  'CardNumber',       $cardData['card_number']         ?? null);
        $add(2,  'PaymentSystem',    $cardData['payment_system']      ?? null);
        $add(3,  'SecureCode',       $cardData['secure_code']         ?? null);
        $add(4,  'ExpirationDate',   $cardData['expiration_date']     ?? null);
        $add(6,  'Usermail',         $cardData['email']               ?? null);
        $add(7,  'MobileCountryCode', $cardData['mobile_country_code'] ?? null);
        $add(8,  'MobileNumber',     $cardData['mobile_number']       ?? null);
        $add(9,  'FiCode',           $cardData['fi_code']             ?? null);
        $add(17, 'CardHolderName',   $cardData['card_holder_name']    ?? null);
        $add(18, 'CardHolderIdType', $cardData['card_holder_id_type'] ?? null);
        $add(19, 'CardHolderId',     $cardData['card_holder_id']      ?? null);
        $add(21, 'CardIssueBank',    $cardData['card_issue_bank']     ?? null);
        $add(22, 'AccountType',      isset($cardData['account_type']) ? (string)$cardData['account_type'] : null);
        $add(20, 'CardIssueCountry', $cardData['card_issue_country']  ?? null);

        if (!empty($cardData['customer_id'])) {
            $items[] = ['AttributeCode' => 100, 'AttributeDesc' => 'CustomerId', 'AttributeValue' => (string)$cardData['customer_id']];
        }

        return $items;
    }

    /**
     * @param  array<string, mixed> $res
     * @return SavedCard
     */
    private function mapTokenResponse(array $res): SavedCard
    {
        $arr = $res['TokenInfoArray'] ?? [];

        $findAttr = function (int $code) use ($arr): ?string {
            foreach ($arr as $item) {
                if ((int)($item['AttributeCode'] ?? -1) === $code) {
                    return $item['AttributeValue'] ?? null;
                }
            }
            return null;
        };

        return new SavedCard([
            'token_id'       => $findAttr(1) ?? '',
            'masked_card'    => $findAttr(12),
            'last4'          => $findAttr(11),
            'payment_system' => $findAttr(2),
            'fi_code'        => $findAttr(9),
            'fi_name'        => $findAttr(10),
            'brand_image_url' => $findAttr(13),
            'requires_otp'   => $findAttr(25) !== null,
            'lifetime_secs'  => $res['LifetimeSecs'] ?? null,
        ]);
    }
}
