<?php

declare(strict_types=1);

namespace Ecollect\Tests;

use Ecollect\Config;
use Ecollect\Exceptions\DuplicateTransactionException;
use Ecollect\Exceptions\ValidationException;
use Ecollect\Modules\PaymentsModule;
use Ecollect\Modules\SessionModule;
use Ecollect\Types\Customer;
use Ecollect\Types\PaymentIntent;
use Ecollect\Utils\HttpClient;
use PHPUnit\Framework\MockObject\MockObject;
use PHPUnit\Framework\TestCase;

class PaymentsModuleTest extends TestCase
{
    private function makeConfig(array $overrides = []): Config
    {
        return new Config(array_merge([
            'api_key'     => 'test-key',
            'ety_code'    => 123,
            'environment' => 'test',
            'srv_code'    => 456,
        ], $overrides));
    }

    /** @return HttpClient&MockObject */
    private function mockHttp(array $response): HttpClient
    {
        $mock = $this->createMock(HttpClient::class);
        $mock->method('post')->willReturn($response);
        return $mock;
    }

    /** @return SessionModule&MockObject */
    private function mockSession(string $token = 'session-token'): SessionModule
    {
        $mock = $this->createMock(SessionModule::class);
        $mock->method('getActive')->willReturn($token);
        return $mock;
    }

    private function makeIntent(array $overrides = []): PaymentIntent
    {
        return new PaymentIntent(array_merge([
            'amount'   => 100.0,
            'currency' => 'COP',
            'customer' => new Customer([
                'email'     => 'user@example.com',
                'full_name' => 'Juan Perez',
            ]),
            'srv_code' => 456,
        ], $overrides));
    }

    public function testProcessHappyPath(): void
    {
        $http = $this->mockHttp([
            'ReturnCode'          => 'SUCCESS',
            'TicketId'            => 99001,
            'TransactionResponse' => [
                'TranState'    => 'CREATED',
                'TicketId'     => 99001,
                'TransValue'   => 100.0,
                'PayCurrency'  => 'COP',
            ],
        ]);

        $module = new PaymentsModule($this->makeConfig(), $http, $this->mockSession());
        $result = $module->process($this->makeIntent());

        $this->assertSame('SUCCESS', $result['returnCode']);
        $this->assertSame(99001, $result['ticketId']);
    }

    public function testProcessRequiresSrvCode(): void
    {
        $config = new Config([
            'api_key'     => 'test-key',
            'ety_code'    => 123,
            'environment' => 'test',
            // No srv_code
        ]);

        $http   = $this->createMock(HttpClient::class);
        $module = new PaymentsModule($config, $http, $this->mockSession());

        $intent = new PaymentIntent([
            'amount'   => 100.0,
            'currency' => 'COP',
            'customer' => new Customer([
                'email'     => 'user@example.com',
                'full_name' => 'Juan Perez',
            ]),
            // No srv_code on intent either
        ]);

        $this->expectException(ValidationException::class);
        $this->expectExceptionMessageMatches('/srvCode is required/');
        $module->process($intent);
    }

    public function testProcessThrowsDuplicateTransaction(): void
    {
        $http = $this->mockHttp(['ReturnCode' => 'FAIL_MERCHANTRANSID']);

        $module = new PaymentsModule($this->makeConfig(), $http, $this->mockSession());

        $this->expectException(DuplicateTransactionException::class);
        $module->process($this->makeIntent());
    }

    public function testAutoRefreshesSessionOnExpired(): void
    {
        $callCount = 0;

        $httpMock = $this->createMock(HttpClient::class);
        $httpMock->method('post')
            ->willReturnCallback(function () use (&$callCount): array {
                $callCount++;
                if ($callCount === 1) {
                    return ['ReturnCode' => 'FAIL_APIEXPIREDSESSION'];
                }
                return [
                    'ReturnCode' => 'SUCCESS',
                    'TicketId'   => 12345,
                ];
            });

        $session = $this->createMock(SessionModule::class);
        $session->method('getActive')->willReturn('token');
        $session->expects($this->once())->method('invalidate');

        $module = new PaymentsModule($this->makeConfig(), $httpMock, $session);
        $result = $module->process($this->makeIntent());

        $this->assertSame('SUCCESS', $result['returnCode']);
    }

    public function testCaptureRequiresPositiveTicketId(): void
    {
        $http   = $this->createMock(HttpClient::class);
        $module = new PaymentsModule($this->makeConfig(), $http, $this->mockSession());

        $this->expectException(ValidationException::class);
        $module->capture(-5);
    }

    public function testVoidSendsNegativeTicketId(): void
    {
        $captured = null;
        $httpMock = $this->createMock(HttpClient::class);
        $httpMock->method('post')
            ->willReturnCallback(function (string $url, array $body) use (&$captured): array {
                $captured = $body;
                return ['ReturnCode' => 'SUCCESS'];
            });

        $module = new PaymentsModule($this->makeConfig(), $httpMock, $this->mockSession());
        $module->void(999);

        $this->assertSame(-999, $captured['RequestType']);
    }

    public function testHostedCheckoutRequiresRedirectUrl(): void
    {
        $http   = $this->createMock(HttpClient::class);
        $module = new PaymentsModule($this->makeConfig(), $http, $this->mockSession());

        $intent = $this->makeIntent(); // No redirect_url
        $this->expectException(ValidationException::class);
        $this->expectExceptionMessageMatches('/redirectUrl/');
        $module->hostedCheckout($intent);
    }

    public function testIsDoublePaymentState(): void
    {
        $this->assertTrue(PaymentsModule::isDoublePaymentState('BANK'));
        $this->assertTrue(PaymentsModule::isDoublePaymentState('PENDING'));
        $this->assertTrue(PaymentsModule::isDoublePaymentState('CAPTURED'));
        $this->assertTrue(PaymentsModule::isDoublePaymentState('CREATED'));
        $this->assertFalse(PaymentsModule::isDoublePaymentState('OK'));
        $this->assertFalse(PaymentsModule::isDoublePaymentState('NOT_AUTHORIZED'));
        $this->assertFalse(PaymentsModule::isDoublePaymentState('FAILED'));
    }
}
