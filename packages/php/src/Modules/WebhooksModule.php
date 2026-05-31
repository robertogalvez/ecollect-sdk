<?php

declare(strict_types=1);

namespace Ecollect\Modules;

use Ecollect\Config;
use Ecollect\Exceptions\WebhookValidationException;
use Ecollect\Utils\Crypto;
use Ecollect\Utils\ErrorMapper;
use Ecollect\Utils\HttpClient;

/**
 * Handles webhook signature verification and confirmation via ecollect API.
 */
class WebhooksModule
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
     * Verify HMAC-SHA256 signature of a webhook payload.
     * The signature is computed over json_encode($payload) with $secret.
     *
     * @param  array<string, mixed> $payload
     * @param  string               $signature hex-encoded signature to verify
     * @param  string               $secret    shared secret
     * @return bool
     */
    public function verifyWebhookSignature(array $payload, string $signature, string $secret): bool
    {
        $expected = Crypto::hmacSha256(json_encode($payload), $secret);
        return Crypto::timingSafeEqual($expected, strtolower($signature));
    }

    /**
     * Confirm a webhook by verifying the SessionToken via ecollect API.
     *
     * @param  array<string, mixed> $payload      Webhook payload from ecollect
     * @param  string               $sessionToken Active session token to use for verification
     * @return array<string, mixed>               Transaction result from payload
     * @throws WebhookValidationException
     */
    public function confirmWebhook(array $payload, string $sessionToken = ''): array
    {
        if (empty($payload['SessionToken'])) {
            throw new WebhookValidationException('Webhook payload is missing SessionToken');
        }
        if (empty($payload['TicketId'])) {
            throw new WebhookValidationException('Webhook payload is missing TicketId');
        }

        $url         = $this->config->baseUrl() . '/verifySessionToken';
        $activeToken = $sessionToken ?: $this->session->getActive();

        $body = [
            'EntityCode'           => $this->config->etyCode,
            'SessionToken'         => $activeToken,
            'SessionTokenToVerify' => $payload['SessionToken'],
            'TicketIdToVerify'     => $payload['TicketId'],
        ];

        $res = $this->http->post($url, $body);

        if (($res['ReturnCode'] ?? '') !== 'SUCCESS') {
            throw ErrorMapper::map($res['ReturnCode'] ?? 'FAIL_SYSTEM', "verifySessionToken failed: " . ($res['ReturnCode'] ?? ''));
        }

        return [
            'returnCode'      => $payload['ReturnCode']     ?? '',
            'ticketId'        => $payload['TicketId']        ?? null,
            'tranState'       => $payload['TranState']       ?? null,
            'trazabilityCode' => $payload['TrazabilityCode'] ?? null,
            'transValue'      => $payload['TransValue']      ?? null,
            'transVatValue'   => $payload['TransVatValue']   ?? null,
            'payCurrency'     => $payload['PayCurrency']     ?? null,
            'bankProcessDate' => $payload['BankProcessDate'] ?? null,
            'fiCode'          => $payload['FICode']          ?? null,
            'fiName'          => $payload['FiName']          ?? null,
            'paymentSystem'   => $payload['PaymentSystem']   ?? null,
            'referenceArray'  => $payload['ReferenceArray']  ?? null,
            'srvCode'         => $payload['SrvCode']         ?? null,
        ];
    }

    /**
     * Build the response body that ecollect expects from a webhook endpoint.
     *
     * @param  bool                 $success
     * @return array<string, mixed>
     */
    public static function buildWebhookResponse(bool $success): array
    {
        return ['ReturnCode' => $success ? 'SUCCESS' : 'FAIL_SYSTEM'];
    }
}
