<?php

declare(strict_types=1);

namespace Ecollect\Modules;

use Ecollect\Config;
use Ecollect\Utils\ErrorMapper;
use Ecollect\Utils\HttpClient;

/**
 * Retrieves available payment methods for the merchant.
 */
class PaymentSystemsModule
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
     * Retrieve all payment systems enabled for this merchant.
     *
     * @return array<int, array<string, mixed>>
     */
    public function getPaymentSystems(): array
    {
        $url          = $this->config->baseUrl() . '/getPaymentSystem';
        $sessionToken = $this->session->getActive();

        $body = [
            'EntityCode'   => $this->config->etyCode,
            'SessionToken' => $sessionToken,
        ];

        $res = $this->http->post($url, $body);

        if (($res['ReturnCode'] ?? '') === 'NO_RECORDS') {
            return [];
        }

        if (($res['ReturnCode'] ?? '') === 'FAIL_APIEXPIREDSESSION') {
            $this->session->invalidate();
            $body['SessionToken'] = $this->session->getActive();
            $res                  = $this->http->post($url, $body);

            if (
                ($res['ReturnCode'] ?? '') !== 'SUCCESS'
                && ($res['ReturnCode'] ?? '') !== 'NO_RECORDS'
            ) {
                throw ErrorMapper::map($res['ReturnCode'] ?? 'FAIL_SYSTEM');
            }

            if (($res['ReturnCode'] ?? '') === 'NO_RECORDS') {
                return [];
            }
        } elseif (($res['ReturnCode'] ?? '') !== 'SUCCESS') {
            throw ErrorMapper::map($res['ReturnCode'] ?? 'FAIL_SYSTEM');
        }

        return $this->mapPaymentSystems($res);
    }

    /**
     * @param  array<string, mixed>              $res
     * @return array<int, array<string, mixed>>
     */
    private function mapPaymentSystems(array $res): array
    {
        $result = [];

        foreach (($res['PaymentSystemArray'] ?? []) as $ps) {
            $fiImages = [];
            foreach (($ps['FiImagesArray'] ?? []) as $fi) {
                $fiImages[] = [
                    'fiCode'        => $fi['FiCode']        ?? null,
                    'findKeys'      => $fi['FindKeys']      ?? null,
                    'brandImageUrl' => $fi['BrandImageUrl'] ?? null,
                ];
            }

            $fiArray = [];
            foreach (($ps['FiArray'] ?? []) as $fi) {
                $fiArray[] = [
                    'fiCode' => $fi['FiCode'] ?? null,
                    'fiName' => $fi['FiName'] ?? null,
                ];
            }

            $result[] = [
                'paymentSystem'        => $ps['PaymentSystem']  ?? null,
                'brandImageUrl'        => $ps['BrandImageUrl']  ?? null,
                'fiImages'             => $fiImages,
                'financialInstitutions' => $fiArray,
            ];
        }

        return $result;
    }
}
