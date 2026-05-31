<?php

declare(strict_types=1);

namespace Ecollect\Modules;

use Ecollect\Config;
use Ecollect\Exceptions\ValidationException;
use Ecollect\Types\PaymentIntent;
use Ecollect\Utils\ErrorMapper;
use Ecollect\Utils\HttpClient;
use Ecollect\Utils\Validators;

/**
 * Handles payment processing: process, preAuthorize, capture, void, hostedCheckout.
 */
class PaymentsModule
{
    const DOUBLE_PAYMENT_STATES = ['BANK', 'PENDING', 'CAPTURED', 'CREATED'];

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
     * Process a payment (RequestType=0 — immediate authorization).
     *
     * @param  PaymentIntent        $intent
     * @return array<string, mixed>
     */
    public function process(PaymentIntent $intent): array
    {
        Validators::validatePaymentIntent($intent, $this->config->etyCode);
        $srvCode = $intent->srvCode ?? $this->config->srvCode;

        if (!$srvCode) {
            throw new ValidationException('srvCode is required (set in PaymentIntent or EcollectClient config)');
        }

        return $this->send(array_merge(
            $this->buildBaseBody($intent, $srvCode),
            ['RequestType' => 0]
        ));
    }

    /**
     * Pre-authorize a payment (RequestType=1 — reserve funds).
     *
     * @param  PaymentIntent        $intent
     * @return array<string, mixed>
     */
    public function preAuthorize(PaymentIntent $intent): array
    {
        Validators::validatePaymentIntent($intent, $this->config->etyCode);
        $srvCode = $intent->srvCode ?? $this->config->srvCode;

        if (!$srvCode) {
            throw new ValidationException('srvCode is required');
        }

        return $this->send(array_merge(
            $this->buildBaseBody($intent, $srvCode),
            ['RequestType' => 1]
        ));
    }

    /**
     * Capture a pre-authorized payment (RequestType = ticketId positive).
     *
     * @param  int                  $ticketId
     * @param  float|null           $finalAmount
     * @return array<string, mixed>
     */
    public function capture(int $ticketId, ?float $finalAmount = null): array
    {
        if ($ticketId <= 0) {
            throw new ValidationException('ticketId must be a positive number');
        }

        $body = [
            'EntityCode'  => $this->config->etyCode,
            'RequestType' => $ticketId,
        ];

        if ($finalAmount !== null) {
            $body['TransValue'] = $finalAmount;
        }

        return $this->send($body);
    }

    /**
     * Void a pre-authorized payment (RequestType = -ticketId).
     *
     * @param  int                  $ticketId
     * @return array<string, mixed>
     */
    public function void(int $ticketId): array
    {
        if ($ticketId <= 0) {
            throw new ValidationException('ticketId must be a positive number');
        }

        return $this->send([
            'EntityCode'  => $this->config->etyCode,
            'RequestType' => -$ticketId,
        ]);
    }

    /**
     * Hosted checkout: redirect user to ecollect payment page.
     * Returns result with eCollectUrl for redirect.
     *
     * @param  PaymentIntent        $intent
     * @return array<string, mixed>
     */
    public function hostedCheckout(PaymentIntent $intent): array
    {
        if (!$intent->redirectUrl) {
            throw new ValidationException('redirectUrl is required for hostedCheckout');
        }

        return $this->process($intent);
    }

    /**
     * Process with extra PaymentInfoArray items (used by PaymentLinksModule).
     *
     * @param  PaymentIntent                      $intent
     * @param  array<int, array<string, mixed>>   $extraInfo
     * @return array<string, mixed>
     * @internal
     */
    public function processWithExtraInfo(PaymentIntent $intent, array $extraInfo): array
    {
        Validators::validatePaymentIntent($intent, $this->config->etyCode);
        $srvCode = $intent->srvCode ?? $this->config->srvCode;

        if (!$srvCode) {
            throw new ValidationException('srvCode is required');
        }

        $base                    = $this->buildBaseBody($intent, $srvCode);
        $base['RequestType']     = 0;
        $existingInfo            = $base['PaymentInfoArray'] ?? [];
        $base['PaymentInfoArray'] = array_merge($existingInfo, $extraInfo);

        return $this->send($base);
    }

    /**
     * Check whether a TranState prevents retry (double-payment guard).
     */
    public static function isDoublePaymentState(string $tranState): bool
    {
        return in_array($tranState, self::DOUBLE_PAYMENT_STATES, true);
    }

    // -------------------------------------------------------------------------
    // Private helpers
    // -------------------------------------------------------------------------

    /**
     * @param  array<string, mixed> $body
     * @return array<string, mixed>
     */
    private function send(array $body): array
    {
        $url          = $this->config->baseUrl() . '/createTransactionPayment';
        $sessionToken = $this->session->getActive();

        $body['SessionToken'] = $sessionToken;

        $res = $this->http->post($url, $body);

        if (($res['ReturnCode'] ?? '') === 'FAIL_APIEXPIREDSESSION') {
            $this->session->invalidate();
            $body['SessionToken'] = $this->session->getActive();
            $res                  = $this->http->post($url, $body);

            if (($res['ReturnCode'] ?? '') !== 'SUCCESS') {
                throw ErrorMapper::map($res['ReturnCode'] ?? 'FAIL_SYSTEM');
            }
        } elseif (($res['ReturnCode'] ?? '') !== 'SUCCESS') {
            throw ErrorMapper::map($res['ReturnCode'] ?? 'FAIL_SYSTEM');
        }

        return $this->mapResponse($res);
    }

    /**
     * @param  PaymentIntent        $intent
     * @param  int                  $srvCode
     * @return array<string, mixed>
     */
    private function buildBaseBody(PaymentIntent $intent, int $srvCode): array
    {
        $body = [
            'EntityCode'    => $this->config->etyCode,
            'SrvCode'       => $srvCode,
            'TransValue'    => $intent->amount,
            'SrvCurrency'   => $intent->currency,
            'LangCode'      => $intent->langCode ?? 'ES',
            'ReferenceArray' => $this->buildReferenceArray($intent),
        ];

        if ($intent->vatAmount !== null) {
            $body['TransVatValue'] = $intent->vatAmount;
        }
        if ($intent->redirectUrl) {
            $body['URLRedirect'] = $intent->redirectUrl;
        }
        if ($intent->responseUrl) {
            $body['URLResponse'] = $intent->responseUrl;
        }
        if ($intent->paymentSystem !== null) {
            $body['PaymentSystem'] = $intent->paymentSystem;
        }
        if ($intent->fiCode) {
            $body['FICode'] = $intent->fiCode;
        }
        if ($intent->invoice) {
            $body['Invoice'] = $intent->invoice;
        }
        if ($intent->invoiceDueDate) {
            $body['InvoiceDueDate'] = $intent->invoiceDueDate;
        }
        if ($intent->policyCode) {
            $body['PolicyCode'] = $intent->policyCode;
        }

        $paymentInfo = $this->buildPaymentInfoArray($intent);
        if (!empty($paymentInfo)) {
            $body['PaymentInfoArray'] = $paymentInfo;
        }

        $tokenInfo = $this->buildTokenInfoArray($intent);
        if (!empty($tokenInfo)) {
            $body['TokenInfoArray'] = $tokenInfo;
        }

        $subservices = $this->buildSubservices($intent);
        if (!empty($subservices)) {
            $body['SubservicesArray'] = $subservices;
        }

        return $body;
    }

    /**
     * @param  PaymentIntent $intent
     * @return string[]
     */
    private function buildReferenceArray(PaymentIntent $intent): array
    {
        $c    = $intent->customer;
        $refs = [
            $c->documentType     ?? '',
            $c->documentNumber   ?? '',
            $intent->merchantTransactionId ?? '',
            $c->fullName         ?? '',
            $c->email            ?? '',
            $c->phone            ?? '',
        ];

        if ($intent->additionalReferences) {
            foreach ($intent->additionalReferences as $ref) {
                $refs[] = $ref;
            }
        }

        return $refs;
    }

    /**
     * @param  PaymentIntent                      $intent
     * @return array<int, array<string, mixed>>
     */
    private function buildPaymentInfoArray(PaymentIntent $intent): array
    {
        $items = [];
        $c     = $intent->customer;

        $add = function (int $code, string $desc, $value) use (&$items): void {
            if ($value !== null && $value !== '') {
                $items[] = ['AttributeCode' => $code, 'AttributeDesc' => $desc, 'AttributeValue' => (string)$value];
            }
        };

        $add(6,  'Usermail',             $c->email);
        $add(17, 'CardHolderName',       $c->fullName);
        $add(18, 'CardHolderIdType',     $c->documentType);
        $add(19, 'CardHolderId',         $c->documentNumber);
        $add(23, 'IPAddress',            $intent->ipAddress);
        $add(24, 'DeviceFingerPrint',    $intent->deviceFingerPrint);
        $add(25, 'OneTimePassword',      $intent->oneTimePassword);
        $add(26, 'MerchantTransactionId', $intent->merchantTransactionId);
        $add(34, 'UserType',             $intent->userType);

        return $items;
    }

    /**
     * @param  PaymentIntent                           $intent
     * @return array<int, array<string, mixed>>|null
     */
    private function buildTokenInfoArray(PaymentIntent $intent): ?array
    {
        if (!$intent->tokenId) {
            return null;
        }

        $items = [];
        $c     = $intent->customer;

        $add = function (int $code, string $desc, $value) use (&$items): void {
            if ($value !== null && $value !== '') {
                $items[] = ['AttributeCode' => $code, 'AttributeDesc' => $desc, 'AttributeValue' => (string)$value];
            }
        };

        $add(1,  'TokenId',      $intent->tokenId);
        $add(2,  'PaymentSystem', $intent->paymentSystem);
        $add(3,  'SecureCode',   $intent->secureCode);
        $add(5,  'Installments', $intent->installments);
        $add(6,  'Usermail',     $c->email);
        $add(9,  'FiCode',       $intent->fiCode);
        $add(19, 'CardHolderId', $c->documentNumber);
        $add(25, 'OneTimePassword', $intent->oneTimePassword);

        return $items ?: null;
    }

    /**
     * @param  PaymentIntent                      $intent
     * @return array<int, array<string, mixed>>
     */
    private function buildSubservices(PaymentIntent $intent): array
    {
        if (empty($intent->subservices)) {
            return [];
        }

        $result = [];
        foreach ($intent->subservices as $s) {
            $item = [
                'EntityCode' => $s['entityCode'],
                'SrvCode'    => (string)$s['srvCode'],
                'ValueType'  => $s['valueType'],
                'TransValue' => $s['transValue'],
            ];
            if (isset($s['transVatValue'])) {
                $item['TransVatValue'] = $s['transVatValue'];
            }
            $result[] = $item;
        }

        return $result;
    }

    /**
     * @param  array<string, mixed> $res
     * @return array<string, mixed>
     */
    private function mapResponse(array $res): array
    {
        $tr = $res['TransactionResponse'] ?? [];

        return [
            'returnCode'     => $res['ReturnCode']    ?? '',
            'ticketId'       => $res['TicketId']       ?? ($tr['TicketId']       ?? null),
            'eCollectUrl'    => $res['eCollectUrl']    ?? null,
            'lifetimeSecs'   => $res['LifetimeSecs']  ?? null,
            'tranState'      => $tr['TranState']       ?? null,
            'trazabilityCode' => $tr['TrazabilityCode'] ?? null,
            'transValue'     => $tr['TransValue']      ?? null,
            'transVatValue'  => $tr['TransVatValue']   ?? null,
            'payCurrency'    => $tr['PayCurrency']     ?? null,
            'currencyRate'   => $tr['CurrencyRate']    ?? null,
            'bankProcessDate' => $tr['BankProcessDate'] ?? null,
            'fiCode'         => $tr['FICode']          ?? null,
            'fiName'         => $tr['FiName']          ?? null,
            'paymentSystem'  => $tr['PaymentSystem']   ?? null,
            'tranCycle'      => $tr['TransCycle']      ?? null,
            'invoice'        => $tr['Invoice']         ?? null,
            'referenceArray' => $tr['ReferenceArray']  ?? null,
            'srvCode'        => $tr['SrvCode']         ?? null,
        ];
    }
}
