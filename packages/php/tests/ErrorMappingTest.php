<?php

declare(strict_types=1);

namespace Ecollect\Tests;

use Ecollect\Exceptions\AuthenticationException;
use Ecollect\Exceptions\CustomerException;
use Ecollect\Exceptions\DuplicateTransactionException;
use Ecollect\Exceptions\EcollectException;
use Ecollect\Exceptions\InvalidCardException;
use Ecollect\Exceptions\InvalidConfigException;
use Ecollect\Exceptions\NetworkRetryableException;
use Ecollect\Exceptions\SessionExpiredException;
use Ecollect\Exceptions\TokenNotFoundException;
use Ecollect\Exceptions\ValidationException;
use Ecollect\Exceptions\WebhookValidationException;
use Ecollect\Utils\ErrorMapper;
use PHPUnit\Framework\TestCase;

class ErrorMappingTest extends TestCase
{
    /** @dataProvider errorMappingProvider */
    public function testErrorMapping(string $returnCode, string $expectedClass): void
    {
        $exception = ErrorMapper::map($returnCode);
        $this->assertInstanceOf($expectedClass, $exception);
        $this->assertSame($returnCode, $exception->getReturnCode());
    }

    public function errorMappingProvider(): array
    {
        return [
            ['FAIL_APIEXPIREDSESSION',    SessionExpiredException::class],
            ['FAIL_INVALIDENTITYCODE',    InvalidConfigException::class],
            ['FAIL_INVALIDSERVICECODE',   InvalidConfigException::class],
            ['FAIL_INVALIDCREDITCARD',    InvalidCardException::class],
            ['FAIL_INVALIDEXPIRATIONDATE', InvalidCardException::class],
            ['FAIL_TOKENNOTFOUND',        TokenNotFoundException::class],
            ['FAIL_TOKENEXPIRED',         TokenNotFoundException::class],
            ['FAIL_MERCHANTRANSID',       DuplicateTransactionException::class],
            ['FAIL_ACCESSDENIED',         AuthenticationException::class],
            ['FAIL_SESSIONNOTFOUND',      WebhookValidationException::class],
            ['FAIL_TICKETIDNOTMATCH',     WebhookValidationException::class],
            ['FAIL_SYSTEM',              NetworkRetryableException::class],
            ['FAIL_INVALIDTRANSVALUE',    ValidationException::class],
            ['FAIL_INVALIDCURRENCY',      ValidationException::class],
            ['FAIL_MAILFORMAT',           ValidationException::class],
            ['FAIL_CARDHOLDERID',         ValidationException::class],
            ['FAIL_CARDHOLDERIDTYPE',     ValidationException::class],
            ['FAIL_MOBILECOUNTRYCODE',    ValidationException::class],
            ['FAIL_MOBILENUMBER',         ValidationException::class],
            ['FAIL_CUSTOMERNOTFOUND',     CustomerException::class],
            ['FAIL_USERMISMATCH',         CustomerException::class],
        ];
    }

    public function testUnknownCodeReturnsBaseException(): void
    {
        $exception = ErrorMapper::map('FAIL_UNKNOWN_CODE');
        $this->assertInstanceOf(EcollectException::class, $exception);
        $this->assertStringContainsString('FAIL_UNKNOWN_CODE', $exception->getMessage());
    }

    public function testSystemErrorIsNetworkRetryable(): void
    {
        $exception = ErrorMapper::map('FAIL_SYSTEM', 'Custom error message');
        $this->assertInstanceOf(NetworkRetryableException::class, $exception);
    }

    public function testSessionExpiredHasCorrectCode(): void
    {
        $ex = ErrorMapper::map('FAIL_APIEXPIREDSESSION');
        $this->assertSame('SESSION_EXPIRED', $ex->getCodeStr());
    }
}
