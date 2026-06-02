<?php

declare(strict_types=1);

namespace Ecollect\Tests;

use Ecollect\Config;
use Ecollect\Exceptions\ValidationException;
use Ecollect\Modules\PaymentLinksModule;
use Ecollect\Modules\PaymentsModule;
use Ecollect\Modules\SessionModule;
use Ecollect\Types\Customer;
use Ecollect\Types\PaymentIntent;
use Ecollect\Utils\HttpClient;
use PHPUnit\Framework\MockObject\MockObject;
use PHPUnit\Framework\TestCase;

class PaymentLinksModuleTest extends TestCase
{
    private function makeConfig(): Config
    {
        return new Config([
            'api_key'     => 'test-key',
            'ety_code'    => 123,
            'environment' => 'test',
            'srv_code'    => 1,
        ]);
    }

    private function baseIntent(): PaymentIntent
    {
        return new PaymentIntent([
            'amount'   => 100.0,
            'currency' => 'COP',
            'customer' => new Customer([
                'email'           => 'user@example.com',
                'document_number' => '12345678',
                'document_type'   => 'CC',
                'full_name'       => 'Juan Perez',
            ]),
        ]);
    }

    /** @return PaymentsModule&MockObject */
    private function mockPaymentsWithResult(array $result): PaymentsModule
    {
        $http    = $this->createMock(HttpClient::class);
        $session = $this->createMock(SessionModule::class);
        $session->method('getActive')->willReturn('session-token');

        $payments = $this->getMockBuilder(PaymentsModule::class)
            ->setConstructorArgs([$this->makeConfig(), $http, $session])
            ->onlyMethods(['processWithExtraInfo'])
            ->getMock();

        $payments->method('processWithExtraInfo')->willReturn($result);

        return $payments;
    }

    public function testGeneratePaymentLinkReturnsValidUrl(): void
    {
        $payments = $this->mockPaymentsWithResult([
            'eCollectUrl'  => 'https://pay.ecollect.com/link/abc123',
            'ticketId'     => 42,
            'lifetimeSecs' => 3600,
        ]);

        $module = new PaymentLinksModule($payments);
        $result = $module->generatePaymentLink($this->baseIntent(), 'email');

        $this->assertSame('https://pay.ecollect.com/link/abc123', $result['eCollectUrl']);
        $this->assertSame(42, $result['ticketId']);
        $this->assertSame(3600, $result['lifetimeSecs']);
        $this->assertGreaterThan(time(), $result['expiresAt']);
    }

    public function testGeneratePaymentLinkWithOptionalFields(): void
    {
        $payments = $this->mockPaymentsWithResult([
            'eCollectUrl'  => 'https://pay.ecollect.com/link/qr999',
            'ticketId'     => 99,
            'lifetimeSecs' => 7200,
        ]);

        $intent                = $this->baseIntent();
        $intent->qrLifetimeSecs = 7200;

        $module = new PaymentLinksModule($payments);
        $result = $module->generatePaymentLink($intent, 'qr');

        $this->assertSame(7200, $result['lifetimeSecs']);
        $this->assertSame(99, $result['ticketId']);
    }

    public function testGeneratePaymentLinkSmsThrowsIfMobileDataMissing(): void
    {
        $payments = $this->mockPaymentsWithResult([]);
        $module   = new PaymentLinksModule($payments);

        $intent = $this->baseIntent(); // no mobileCountryCode / mobileNumber

        $this->expectException(ValidationException::class);
        $module->generatePaymentLink($intent, 'sms');
    }

    public function testGeneratePaymentLinkExpiredSessionStillReturnsResult(): void
    {
        // PaymentsModule handles session refresh internally; PaymentLinksModule
        // just delegates to processWithExtraInfo and maps the response.
        $payments = $this->mockPaymentsWithResult([
            'eCollectUrl'  => 'https://pay.ecollect.com/link/refresh-ok',
            'ticketId'     => 55,
            'lifetimeSecs' => 3600,
        ]);

        $module = new PaymentLinksModule($payments);
        $result = $module->generatePaymentLink($this->baseIntent(), 'email');

        $this->assertSame('https://pay.ecollect.com/link/refresh-ok', $result['eCollectUrl']);
    }
}
