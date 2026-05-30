<?php

declare(strict_types=1);

namespace Ecollect\Tests;

use Ecollect\Config;
use Ecollect\Exceptions\AuthenticationException;
use Ecollect\Exceptions\InvalidConfigException;
use Ecollect\Modules\SessionModule;
use Ecollect\Utils\HttpClient;
use PHPUnit\Framework\MockObject\MockObject;
use PHPUnit\Framework\TestCase;

class SessionModuleTest extends TestCase
{
    private function makeConfig(array $overrides = []): Config
    {
        return new Config(array_merge([
            'api_key'     => 'test-key',
            'ety_code'    => 123,
            'environment' => 'test',
        ], $overrides));
    }

    /** @return HttpClient&MockObject */
    private function mockHttp(): HttpClient
    {
        return $this->createMock(HttpClient::class);
    }

    public function testCreateFetchesNewToken(): void
    {
        $http = $this->mockHttp();
        $http->expects($this->once())
            ->method('post')
            ->willReturn([
                'ReturnCode'   => 'SUCCESS',
                'SessionToken' => 'tok-abc',
                'LifetimeSecs' => 1800,
            ]);

        $module = new SessionModule($this->makeConfig(), $http);
        $result = $module->create();

        $this->assertSame('tok-abc', $result['token']);
        $this->assertSame(1800, $result['lifetimeSecs']);
        $this->assertGreaterThan(time(), $result['expiresAt']);
    }

    public function testGetActiveCachesToken(): void
    {
        $http = $this->mockHttp();
        $http->expects($this->once()) // Only one HTTP call — second call uses cache
            ->method('post')
            ->willReturn([
                'ReturnCode'   => 'SUCCESS',
                'SessionToken' => 'tok-cached',
                'LifetimeSecs' => 1800,
            ]);

        $module = new SessionModule($this->makeConfig(), $http);
        $token1 = $module->getActive();
        $token2 = $module->getActive();

        $this->assertSame('tok-cached', $token1);
        $this->assertSame('tok-cached', $token2);
    }

    public function testInvalidateForcesFetchOnNextCall(): void
    {
        $http = $this->mockHttp();
        $http->expects($this->exactly(2))
            ->method('post')
            ->willReturn([
                'ReturnCode'   => 'SUCCESS',
                'SessionToken' => 'tok-new',
                'LifetimeSecs' => 1800,
            ]);

        $module = new SessionModule($this->makeConfig(), $http);
        $module->getActive();
        $module->invalidate();
        $module->getActive();
    }

    public function testThrowsOnAccessDenied(): void
    {
        $http = $this->mockHttp();
        $http->method('post')
            ->willReturn(['ReturnCode' => 'FAIL_ACCESSDENIED']);

        $module = new SessionModule($this->makeConfig(), $http);

        $this->expectException(AuthenticationException::class);
        $module->create();
    }

    public function testThrowsOnInvalidEntityCode(): void
    {
        $http = $this->mockHttp();
        $http->method('post')
            ->willReturn(['ReturnCode' => 'FAIL_INVALIDENTITYCODE']);

        $module = new SessionModule($this->makeConfig(), $http);

        $this->expectException(InvalidConfigException::class);
        $module->create();
    }
}
