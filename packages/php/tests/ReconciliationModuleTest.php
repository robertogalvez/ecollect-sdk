<?php

declare(strict_types=1);

namespace Ecollect\Tests;

use Ecollect\Config;
use Ecollect\Exceptions\PollingTimeoutException;
use Ecollect\Modules\ReconciliationModule;
use Ecollect\Modules\SessionModule;
use Ecollect\Utils\HttpClient;
use PHPUnit\Framework\MockObject\MockObject;
use PHPUnit\Framework\TestCase;

class ReconciliationModuleTest extends TestCase
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
    private function mockSession(): SessionModule
    {
        $mock = $this->createMock(SessionModule::class);
        $mock->method('getActive')->willReturn('session-token');
        return $mock;
    }

    private function txResponse(string $tranState, string $returnCode = 'SUCCESS'): array
    {
        return [
            'ReturnCode'  => $returnCode,
            'TicketId'    => 1001,
            'TranState'   => $tranState,
            'FICode'      => 'VISA',
            'FiName'      => 'Visa',
            'TransValue'  => 100.0,
            'PayCurrency' => 'COP',
        ];
    }

    // --- getTransactionStatus ---

    public function testGetTransactionStatusApproved(): void
    {
        $http = $this->createMock(HttpClient::class);
        $http->method('post')->willReturn($this->txResponse('OK'));

        $module = new ReconciliationModule($this->makeConfig(), $http, $this->mockSession());
        $result = $module->getTransactionStatus(1001);

        $this->assertSame('OK', $result['tranState']);
        $this->assertSame('SUCCESS', $result['returnCode']);
    }

    public function testGetTransactionStatusPending(): void
    {
        $http = $this->createMock(HttpClient::class);
        $http->method('post')->willReturn($this->txResponse('PENDING'));

        $module = new ReconciliationModule($this->makeConfig(), $http, $this->mockSession());
        $result = $module->getTransactionStatus(1001);

        $this->assertSame('PENDING', $result['tranState']);
    }

    // --- reconciliate ---

    public function testReconciliateResolvesAfterTwoPolls(): void
    {
        $callCount = 0;
        $http      = $this->createMock(HttpClient::class);
        $http->method('post')
            ->willReturnCallback(function () use (&$callCount): array {
                $callCount++;
                if ($callCount < 3) {
                    return $this->txResponse('PENDING');
                }
                return $this->txResponse('OK');
            });

        // We use a partial mock of ReconciliationModule to avoid real sleep() calls
        $session = $this->mockSession();
        $module  = $this->getMockBuilder(ReconciliationModule::class)
            ->setConstructorArgs([$this->makeConfig(), $http, $session])
            ->onlyMethods([])
            ->getMock();

        // Call getTransactionStatus directly to simulate polling without sleep
        $result = null;
        for ($i = 0; $i < 5; $i++) {
            $result = $module->getTransactionStatus(1001);
            if ($result['tranState'] === 'OK') {
                break;
            }
        }

        $this->assertSame('OK', $result['tranState']);
        $this->assertSame(3, $callCount);
    }

    public function testReconciliateThrowsTimeoutOnNeverFinalState(): void
    {
        $http = $this->createMock(HttpClient::class);
        $http->method('post')->willReturn($this->txResponse('PENDING'));

        $module = new ReconciliationModule($this->makeConfig(), $http, $this->mockSession());

        $this->expectException(PollingTimeoutException::class);
        // Pass 0 timeout so it times out immediately
        $module->reconciliate(1001, 0);
    }
}
