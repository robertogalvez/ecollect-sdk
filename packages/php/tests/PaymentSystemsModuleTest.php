<?php

declare(strict_types=1);

namespace Ecollect\Tests;

use Ecollect\Config;
use Ecollect\Modules\PaymentSystemsModule;
use Ecollect\Modules\SessionModule;
use Ecollect\Utils\HttpClient;
use PHPUnit\Framework\MockObject\MockObject;
use PHPUnit\Framework\TestCase;

class PaymentSystemsModuleTest extends TestCase
{
    private function makeConfig(): Config
    {
        return new Config([
            'api_key'     => 'test-key',
            'ety_code'    => 123,
            'environment' => 'test',
        ]);
    }

    /** @return SessionModule&MockObject */
    private function mockSession(string $token = 'session-token'): SessionModule
    {
        $mock = $this->createMock(SessionModule::class);
        $mock->method('getActive')->willReturn($token);
        return $mock;
    }

    public function testGetPaymentSystemsReturnsArray(): void
    {
        $http = $this->createMock(HttpClient::class);
        $http->method('post')->willReturn([
            'ReturnCode'          => 'SUCCESS',
            'PaymentSystemArray'  => [
                [
                    'PaymentSystem' => '1',
                    'BrandImageUrl' => 'https://cdn.ecollect.com/visa.png',
                    'FiImagesArray' => [],
                    'FiArray'       => [
                        ['FiCode' => 'VISA', 'FiName' => 'Visa'],
                        ['FiCode' => 'MC',   'FiName' => 'Mastercard'],
                    ],
                ],
            ],
        ]);

        $module = new PaymentSystemsModule($this->makeConfig(), $http, $this->mockSession());
        $result = $module->getPaymentSystems();

        $this->assertIsArray($result);
        $this->assertCount(1, $result);
        $this->assertSame('1', $result[0]['paymentSystem']);
    }

    public function testGetPaymentSystemsParseFiCodeAndFiName(): void
    {
        $http = $this->createMock(HttpClient::class);
        $http->method('post')->willReturn([
            'ReturnCode'         => 'SUCCESS',
            'PaymentSystemArray' => [
                [
                    'PaymentSystem' => '2',
                    'BrandImageUrl' => null,
                    'FiImagesArray' => [],
                    'FiArray'       => [
                        ['FiCode' => 'AMEX', 'FiName' => 'American Express'],
                    ],
                ],
            ],
        ]);

        $module = new PaymentSystemsModule($this->makeConfig(), $http, $this->mockSession());
        $result = $module->getPaymentSystems();

        $this->assertSame('AMEX', $result[0]['financialInstitutions'][0]['fiCode']);
        $this->assertSame('American Express', $result[0]['financialInstitutions'][0]['fiName']);
    }

    public function testGetPaymentSystemsReturnsEmptyArrayOnNoRecords(): void
    {
        $http = $this->createMock(HttpClient::class);
        $http->method('post')->willReturn(['ReturnCode' => 'NO_RECORDS']);

        $module = new PaymentSystemsModule($this->makeConfig(), $http, $this->mockSession());
        $result = $module->getPaymentSystems();

        $this->assertSame([], $result);
    }

    public function testGetPaymentSystemsThrowsOnError(): void
    {
        $http = $this->createMock(HttpClient::class);
        $http->method('post')->willReturn(['ReturnCode' => 'FAIL_SYSTEM']);

        $module = new PaymentSystemsModule($this->makeConfig(), $http, $this->mockSession());

        $this->expectException(\Ecollect\Exceptions\NetworkRetryableException::class);
        $module->getPaymentSystems();
    }
}
