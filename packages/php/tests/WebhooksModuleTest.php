<?php

declare(strict_types=1);

namespace Ecollect\Tests;

use Ecollect\Config;
use Ecollect\Exceptions\WebhookValidationException;
use Ecollect\Modules\SessionModule;
use Ecollect\Modules\WebhooksModule;
use Ecollect\Utils\Crypto;
use Ecollect\Utils\HttpClient;
use PHPUnit\Framework\TestCase;

class WebhooksModuleTest extends TestCase
{
    private function makeConfig(): Config
    {
        return new Config([
            'api_key'     => 'test-key',
            'ety_code'    => 123,
            'environment' => 'test',
        ]);
    }

    /** @return SessionModule&\PHPUnit\Framework\MockObject\MockObject */
    private function mockSession(string $token = 'session-token'): SessionModule
    {
        $mock = $this->createMock(SessionModule::class);
        $mock->method('getActive')->willReturn($token);
        return $mock;
    }

    private function makeModule(HttpClient $http = null, SessionModule $session = null): WebhooksModule
    {
        return new WebhooksModule(
            $this->makeConfig(),
            $http ?? $this->createMock(HttpClient::class),
            $session ?? $this->mockSession(),
        );
    }

    // ── verifyWebhookSignature ────────────────────────────────────────────────

    public function testVerifyWebhookSignatureReturnsTrueForValidSignature(): void
    {
        $module  = $this->makeModule();
        $payload = ['TicketId' => 42, 'ReturnCode' => 'SUCCESS'];
        $secret  = 'my-webhook-secret';
        $sig     = Crypto::hmacSha256((string) json_encode($payload), $secret);

        $this->assertTrue($module->verifyWebhookSignature($payload, $sig, $secret));
    }

    public function testVerifyWebhookSignatureReturnsFalseForWrongSignature(): void
    {
        $module  = $this->makeModule();
        $payload = ['TicketId' => 42, 'ReturnCode' => 'SUCCESS'];

        $this->assertFalse($module->verifyWebhookSignature($payload, 'bad-signature', 'my-webhook-secret'));
    }

    public function testVerifyWebhookSignatureReturnsFalseForTamperedPayload(): void
    {
        $module    = $this->makeModule();
        $original  = ['TicketId' => 42, 'ReturnCode' => 'SUCCESS'];
        $secret    = 'my-webhook-secret';
        $sig       = Crypto::hmacSha256((string) json_encode($original), $secret);

        $tampered = ['TicketId' => 99, 'ReturnCode' => 'SUCCESS'];
        $this->assertFalse($module->verifyWebhookSignature($tampered, $sig, $secret));
    }

    public function testVerifyWebhookSignatureIsCaseInsensitiveForHex(): void
    {
        $module  = $this->makeModule();
        $payload = ['event' => 'payment'];
        $secret  = 'secret';
        $sig     = strtoupper(Crypto::hmacSha256((string) json_encode($payload), $secret));

        $this->assertTrue($module->verifyWebhookSignature($payload, $sig, $secret));
    }

    // ── confirmWebhook ────────────────────────────────────────────────────────

    public function testConfirmWebhookReturnsParsedFields(): void
    {
        $http = $this->createMock(HttpClient::class);
        $http->method('post')->willReturn(['ReturnCode' => 'SUCCESS']);

        $module  = $this->makeModule($http);
        $payload = [
            'SessionToken'    => 'wh-session-token',
            'TicketId'        => '12345',
            'ReturnCode'      => 'SUCCESS',
            'TranState'       => 'APPROVED',
            'TrazabilityCode' => 'TC-001',
            'TransValue'      => '100.00',
            'PayCurrency'     => 'COP',
            'FICode'          => '291',
            'PaymentSystem'   => '16',
        ];

        $result = $module->confirmWebhook($payload, 'session-token');

        $this->assertSame('SUCCESS', $result['returnCode']);
        $this->assertSame('12345', $result['ticketId']);
        $this->assertSame('APPROVED', $result['tranState']);
        $this->assertSame('TC-001', $result['trazabilityCode']);
        $this->assertSame('COP', $result['payCurrency']);
        $this->assertSame('291', $result['fiCode']);
        $this->assertSame('16', $result['paymentSystem']);
    }

    public function testConfirmWebhookThrowsWhenSessionTokenMissing(): void
    {
        $this->expectException(WebhookValidationException::class);
        $this->expectExceptionMessageMatches('/SessionToken/i');

        $module = $this->makeModule();
        $module->confirmWebhook(['TicketId' => '123']);
    }

    public function testConfirmWebhookThrowsWhenTicketIdMissing(): void
    {
        $this->expectException(WebhookValidationException::class);
        $this->expectExceptionMessageMatches('/TicketId/i');

        $module = $this->makeModule();
        $module->confirmWebhook(['SessionToken' => 'wh-token']);
    }

    public function testConfirmWebhookThrowsWhenApiReturnsFail(): void
    {
        $http = $this->createMock(HttpClient::class);
        $http->method('post')->willReturn(['ReturnCode' => 'FAIL_SESSIONNOTFOUND']);

        $module = $this->makeModule($http);

        $this->expectException(\Exception::class);
        $module->confirmWebhook(['SessionToken' => 'bad-token', 'TicketId' => '1']);
    }

    // ── buildWebhookResponse ──────────────────────────────────────────────────

    public function testBuildWebhookResponseSuccess(): void
    {
        $resp = WebhooksModule::buildWebhookResponse(true);
        $this->assertSame('SUCCESS', $resp['ReturnCode']);
    }

    public function testBuildWebhookResponseFailure(): void
    {
        $resp = WebhooksModule::buildWebhookResponse(false);
        $this->assertSame('FAIL_SYSTEM', $resp['ReturnCode']);
    }
}
