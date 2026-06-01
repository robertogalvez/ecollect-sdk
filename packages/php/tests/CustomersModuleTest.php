<?php

declare(strict_types=1);

namespace Ecollect\Tests;

use Ecollect\Config;
use Ecollect\Exceptions\CustomerException;
use Ecollect\Exceptions\ValidationException;
use Ecollect\Modules\CustomersModule;
use Ecollect\Modules\SessionModule;
use Ecollect\Utils\HttpClient;
use PHPUnit\Framework\MockObject\MockObject;
use PHPUnit\Framework\TestCase;

class CustomersModuleTest extends TestCase
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

    private function customerInfo(): array
    {
        return [
            'email'               => 'user@example.com',
            'document_number'     => '12345678',
            'document_type'       => 'CC',
            'full_name'           => 'Juan Perez',
            'mobile_country_code' => '57',
            'mobile_number'       => '3001234567',
        ];
    }

    private function successResponse(string $customerId): array
    {
        return [
            'ReturnCode'        => 'SUCCESS',
            'CustomerInfoArray' => [
                ['AttributeCode' => 100, 'AttributeDesc' => 'CustomerId', 'AttributeValue' => $customerId],
            ],
        ];
    }

    public function testGetOrCreateCustomerIdNewCustomer(): void
    {
        $http = $this->createMock(HttpClient::class);
        $http->method('post')->willReturn($this->successResponse('cust-001'));

        $module = new CustomersModule($this->makeConfig(), $http, $this->mockSession());
        $result = $module->getOrCreateCustomerId($this->customerInfo());

        $this->assertSame('cust-001', $result['customerId']);
        $this->assertSame('user@example.com', $result['email']);
        $this->assertSame('Juan Perez', $result['fullName']);
    }

    public function testGetOrCreateCustomerIdExistingCustomer(): void
    {
        $http = $this->createMock(HttpClient::class);
        $http->method('post')->willReturn($this->successResponse('cust-existing-999'));

        $module = new CustomersModule($this->makeConfig(), $http, $this->mockSession());
        $result = $module->getOrCreateCustomerId($this->customerInfo());

        $this->assertSame('cust-existing-999', $result['customerId']);
    }

    public function testGetOrCreateRetrySucceedsAfterExpiredSession(): void
    {
        $http = $this->createMock(HttpClient::class);
        $http->expects($this->exactly(2))
            ->method('post')
            ->willReturnOnConsecutiveCalls(
                ['ReturnCode' => 'FAIL_APIEXPIREDSESSION'],
                $this->successResponse('cust-retry-001')
            );

        $session = $this->createMock(SessionModule::class);
        $session->method('getActive')->willReturn('session-token');

        $module = new CustomersModule($this->makeConfig(), $http, $session);
        $result = $module->getOrCreateCustomerId($this->customerInfo());

        $this->assertSame('cust-retry-001', $result['customerId']);
    }

    public function testGetOrCreateThrowsOnExpiredSessionRetryFails(): void
    {
        $http = $this->createMock(HttpClient::class);
        $http->expects($this->exactly(2))
            ->method('post')
            ->willReturnOnConsecutiveCalls(
                ['ReturnCode' => 'FAIL_APIEXPIREDSESSION'],
                ['ReturnCode' => 'FAIL_SYSTEM']
            );

        $session = $this->createMock(SessionModule::class);
        $session->method('getActive')->willReturn('session-token');

        $module = new CustomersModule($this->makeConfig(), $http, $session);

        $this->expectException(\Ecollect\Exceptions\NetworkRetryableException::class);
        $module->getOrCreateCustomerId($this->customerInfo());
    }

    public function testUpdateCustomerInfoSuccess(): void
    {
        $http = $this->createMock(HttpClient::class);
        $http->method('post')->willReturn([
            'ReturnCode'        => 'SUCCESS',
            'CustomerInfoArray' => [
                ['AttributeCode' => 100, 'AttributeDesc' => 'CustomerId', 'AttributeValue' => 'cust-001'],
            ],
        ]);

        $module = new CustomersModule($this->makeConfig(), $http, $this->mockSession());
        $result = $module->updateCustomerInfo('cust-001', [
            'email'     => 'new@example.com',
            'full_name' => 'Juan Updated',
        ]);

        $this->assertSame('cust-001', $result['customerId']);
        $this->assertSame('new@example.com', $result['email']);
    }

    public function testUpdateCustomerInfoThrowsOnNotFound(): void
    {
        $http = $this->createMock(HttpClient::class);
        $http->method('post')->willReturn(['ReturnCode' => 'FAIL_CARDHOLDERID']);

        $module = new CustomersModule($this->makeConfig(), $http, $this->mockSession());

        $this->expectException(ValidationException::class);
        $module->updateCustomerInfo('bad-id', ['email' => 'x@y.com']);
    }

    public function testGetOrCreateThrowsMissingCustomerIdInResponse(): void
    {
        $http = $this->createMock(HttpClient::class);
        $http->method('post')->willReturn([
            'ReturnCode'        => 'SUCCESS',
            'CustomerInfoArray' => [],
        ]);

        $module = new CustomersModule($this->makeConfig(), $http, $this->mockSession());

        $this->expectException(CustomerException::class);
        $module->getOrCreateCustomerId($this->customerInfo());
    }
}
