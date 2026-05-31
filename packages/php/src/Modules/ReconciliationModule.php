<?php

declare(strict_types=1);

namespace Ecollect\Modules;

use Ecollect\Config;
use Ecollect\Exceptions\PollingTimeoutException;
use Ecollect\Utils\ErrorMapper;
use Ecollect\Utils\HttpClient;
use Ecollect\Utils\Polling;

/**
 * Handles transaction status queries and polling reconciliation.
 */
class ReconciliationModule
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
     * Query the current state of a transaction.
     *
     * @param  int                  $ticketId
     * @param  string|null          $merchantTransactionId Fallback if ticketId unavailable
     * @return array<string, mixed>
     */
    public function getTransactionStatus(int $ticketId, ?string $merchantTransactionId = null): array
    {
        $url          = $this->config->transactionInfoUrl();
        $sessionToken = $this->session->getActive();

        $body = [
            'EntityCode'   => $this->config->etyCode,
            'SessionToken' => $sessionToken,
            'TicketId'     => $ticketId,
        ];

        if ($merchantTransactionId) {
            $body['PaymentInfoArray'] = [[
                'AttributeCode'  => 26,
                'AttributeDesc'  => 'MerchantTransactionId',
                'AttributeValue' => $merchantTransactionId,
            ]];
        }

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

        return $this->mapTxInfo($res);
    }

    /**
     * Synchronous polling reconciliation.
     * Blocks until a final transaction state is reached or timeout expires.
     *
     * @param  int                  $ticketId
     * @param  int                  $timeoutSecs Default: 600 (10 minutes)
     * @return array<string, mixed> Final transaction result
     * @throws PollingTimeoutException
     */
    public function reconciliate(int $ticketId, int $timeoutSecs = 600): array
    {
        return Polling::waitForFinalState(
            $ticketId,
            function (int $id): array {
                return $this->getTransactionStatus($id);
            },
            $timeoutSecs
        );
    }

    /**
     * @param  array<string, mixed> $res
     * @return array<string, mixed>
     */
    private function mapTxInfo(array $res): array
    {
        return [
            'returnCode'      => $res['ReturnCode']      ?? '',
            'ticketId'        => $res['TicketId']         ?? null,
            'tranState'       => $res['TranState']        ?? null,
            'trazabilityCode' => $res['TrazabilityCode']  ?? null,
            'transValue'      => $res['TransValue']       ?? null,
            'transVatValue'   => $res['TransVatValue']    ?? null,
            'payCurrency'     => $res['PayCurrency']      ?? null,
            'currencyRate'    => $res['CurrencyRate']     ?? null,
            'bankProcessDate' => $res['BankProcessDate']  ?? null,
            'fiCode'          => $res['FICode']           ?? null,
            'fiName'          => $res['FiName']           ?? null,
            'paymentSystem'   => $res['PaymentSystem']    ?? null,
            'tranCycle'       => $res['TransCycle']       ?? null,
            'invoice'         => $res['Invoice']          ?? null,
            'referenceArray'  => $res['ReferenceArray']   ?? null,
            'srvCode'         => $res['SrvCode']          ?? null,
        ];
    }
}
