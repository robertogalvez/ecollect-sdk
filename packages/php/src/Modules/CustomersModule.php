<?php

declare(strict_types=1);

namespace Ecollect\Modules;

use Ecollect\Config;
use Ecollect\Exceptions\CustomerException;
use Ecollect\Utils\ErrorMapper;
use Ecollect\Utils\HttpClient;

/**
 * Manages customer IDs for tokenisation (getOrCreate and update).
 */
class CustomersModule
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
     * Get or create a CustomerId for a customer.
     *
     * @param  array<string, string> $customerInfo Keys: email, document_number, document_type, full_name, mobile_country_code, mobile_number
     * @return array<string, mixed>
     * @throws CustomerException
     */
    public function getOrCreateCustomerId(array $customerInfo): array
    {
        $url          = $this->config->baseUrl() . '/getCustomerId';
        $sessionToken = $this->session->getActive();

        $customerInfoArray = [];

        $add = function (int $code, string $desc, ?string $value) use (&$customerInfoArray): void {
            if ($value !== null && $value !== '') {
                $customerInfoArray[] = ['AttributeCode' => $code, 'AttributeDesc' => $desc, 'AttributeValue' => $value];
            }
        };

        $add(6,  'Usermail',          $customerInfo['email']               ?? null);
        $add(19, 'CardHolderId',      $customerInfo['document_number']     ?? null);
        $add(18, 'CardHolderIdType',  $customerInfo['document_type']       ?? null);
        $add(17, 'CardHolderName',    $customerInfo['full_name']           ?? null);
        $add(7,  'MobileCountryCode', $customerInfo['mobile_country_code'] ?? null);
        $add(8,  'MobileNumber',      $customerInfo['mobile_number']       ?? null);

        $body = [
            'EntityCode'         => $this->config->etyCode,
            'SessionToken'       => $sessionToken,
            'CustomerInfoArray'  => $customerInfoArray,
        ];

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

        return $this->parseCustomer($res, $customerInfo);
    }

    /**
     * Update customer information by providing a CustomerId.
     *
     * @param  string                $customerId
     * @param  array<string, string> $updatedInfo
     * @return array<string, mixed>
     */
    public function updateCustomerInfo(string $customerId, array $updatedInfo): array
    {
        $url          = $this->config->baseUrl() . '/getCustomerId';
        $sessionToken = $this->session->getActive();

        $items = [
            ['AttributeCode' => 100, 'AttributeDesc' => 'CustomerId', 'AttributeValue' => $customerId],
        ];

        $add = function (int $code, string $desc, ?string $value) use (&$items): void {
            if ($value !== null && $value !== '') {
                $items[] = ['AttributeCode' => $code, 'AttributeDesc' => $desc, 'AttributeValue' => $value];
            }
        };

        $add(6,  'Usermail',          $updatedInfo['email']               ?? null);
        $add(17, 'CardHolderName',    $updatedInfo['full_name']           ?? null);
        $add(18, 'CardHolderIdType',  $updatedInfo['document_type']       ?? null);
        $add(7,  'MobileCountryCode', $updatedInfo['mobile_country_code'] ?? null);
        $add(8,  'MobileNumber',      $updatedInfo['mobile_number']       ?? null);

        $body = [
            'EntityCode'        => $this->config->etyCode,
            'SessionToken'      => $sessionToken,
            'CustomerInfoArray' => $items,
        ];

        $res = $this->http->post($url, $body);

        if (($res['ReturnCode'] ?? '') !== 'SUCCESS') {
            throw ErrorMapper::map($res['ReturnCode'] ?? 'FAIL_SYSTEM');
        }

        return $this->parseCustomer($res, $updatedInfo);
    }

    /**
     * @param  array<string, mixed>  $res
     * @param  array<string, string> $original
     * @return array<string, mixed>
     * @throws CustomerException
     */
    private function parseCustomer(array $res, array $original): array
    {
        $arr = $res['CustomerInfoArray'] ?? [];

        $findAttr = function (int $code) use ($arr): ?string {
            foreach ($arr as $item) {
                if ((int)($item['AttributeCode'] ?? -1) === $code) {
                    return $item['AttributeValue'] ?? null;
                }
            }
            return null;
        };

        $customerId = $findAttr(100);
        if (!$customerId) {
            throw new CustomerException('getCustomerId response did not return a CustomerId');
        }

        return [
            'customerId'         => $customerId,
            'email'              => $original['email']               ?? null,
            'fullName'           => $original['full_name']           ?? null,
            'documentType'       => $original['document_type']       ?? null,
            'documentNumber'     => $original['document_number']     ?? null,
            'mobileCountryCode'  => $original['mobile_country_code'] ?? null,
            'mobileNumber'       => $original['mobile_number']       ?? null,
        ];
    }
}
