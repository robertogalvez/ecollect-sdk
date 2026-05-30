<?php

declare(strict_types=1);

namespace Ecollect\Tests;

use Ecollect\Config;
use Ecollect\Exceptions\InvalidCardException;
use Ecollect\Exceptions\TokenNotFoundException;
use Ecollect\Modules\SessionModule;
use Ecollect\Modules\TokensModule;
use Ecollect\Types\SavedCard;
use Ecollect\Utils\HttpClient;
use PHPUnit\Framework\TestCase;

class TokensModuleTest extends TestCase
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
    private function mockSession(): SessionModule
    {
        $mock = $this->createMock(SessionModule::class);
        $mock->method('getActive')->willReturn('session-token');
        return $mock;
    }

    private function validCardData(): array
    {
        return [
            'card_number'      => '4111111111111111', // Valid Luhn
            'expiration_date'  => '12/2099',
            'payment_system'   => '1',
            'email'            => 'user@example.com',
            'card_holder_name' => 'Juan Perez',
        ];
    }

    public function testSaveReturnsToken(): void
    {
        $http = $this->createMock(HttpClient::class);
        $http->method('post')->willReturn([
            'ReturnCode'     => 'SUCCESS',
            'TokenInfoArray' => [
                ['AttributeCode' => 1,  'AttributeDesc' => 'TokenId',    'AttributeValue' => 'tok-999'],
                ['AttributeCode' => 12, 'AttributeDesc' => 'MaskedCard', 'AttributeValue' => 'VISA ****1111'],
            ],
        ]);

        $module = new TokensModule($this->makeConfig(), $http, $this->mockSession());
        $card   = $module->save($this->validCardData());

        $this->assertInstanceOf(SavedCard::class, $card);
        $this->assertSame('tok-999', $card->tokenId);
        $this->assertSame('VISA ****1111', $card->maskedCard);
    }

    public function testSaveValidatesLuhn(): void
    {
        $http   = $this->createMock(HttpClient::class);
        $module = new TokensModule($this->makeConfig(), $http, $this->mockSession());

        $this->expectException(InvalidCardException::class);
        $module->save(array_merge($this->validCardData(), ['card_number' => '1234567890123456']));
    }

    public function testSaveValidatesExpiry(): void
    {
        $http   = $this->createMock(HttpClient::class);
        $module = new TokensModule($this->makeConfig(), $http, $this->mockSession());

        $this->expectException(InvalidCardException::class);
        $module->save(array_merge($this->validCardData(), ['expiration_date' => '01/2000']));
    }

    public function testListReturnsEmptyOnNoRecords(): void
    {
        $http = $this->createMock(HttpClient::class);
        $http->method('post')->willReturn(['ReturnCode' => 'NO_RECORDS']);

        $module = new TokensModule($this->makeConfig(), $http, $this->mockSession());
        $cards  = $module->list('user@example.com', '12345678');

        $this->assertSame([], $cards);
    }

    public function testListReturnsCards(): void
    {
        $http = $this->createMock(HttpClient::class);
        $http->method('post')->willReturn([
            'ReturnCode' => 'SUCCESS',
            'TokenArray' => [
                [
                    'TokenInfoArray' => [
                        ['AttributeCode' => 1,  'AttributeValue' => 'tok-1'],
                        ['AttributeCode' => 11, 'AttributeValue' => '1111'],
                        ['AttributeCode' => 12, 'AttributeValue' => 'VISA ****1111'],
                    ],
                    'TokenStatus' => 'ACTIVE',
                ],
            ],
        ]);

        $module = new TokensModule($this->makeConfig(), $http, $this->mockSession());
        $cards  = $module->list('user@example.com', '12345678');

        $this->assertCount(1, $cards);
        $this->assertSame('tok-1', $cards[0]->tokenId);
        $this->assertSame('ACTIVE', $cards[0]->tokenStatus);
    }

    public function testDeleteCallsRemoveCommand(): void
    {
        $captured = null;
        $http     = $this->createMock(HttpClient::class);
        $http->method('post')
            ->willReturnCallback(function (string $url, array $body) use (&$captured): array {
                $captured = $body;
                return ['ReturnCode' => 'SUCCESS'];
            });

        $module = new TokensModule($this->makeConfig(), $http, $this->mockSession());
        $module->delete('tok-del', 'user@example.com', 'doc123');

        $this->assertSame('REMOVE', $captured['Command']);
    }

    public function testThrowsTokenNotFoundOnFailCode(): void
    {
        $http = $this->createMock(HttpClient::class);
        $http->method('post')->willReturn(['ReturnCode' => 'FAIL_TOKENNOTFOUND']);

        $module = new TokensModule($this->makeConfig(), $http, $this->mockSession());

        $this->expectException(TokenNotFoundException::class);
        $module->save($this->validCardData());
    }
}
