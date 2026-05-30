<?php

declare(strict_types=1);

namespace Ecollect;

/**
 * Configuration constants and URL resolution for the ecollect SDK.
 */
class Config
{
    /** @var string */
    public $apiKey;

    /** @var int */
    public $etyCode;

    /** @var string 'test' or 'prod' */
    public $environment;

    /** @var int|null Default service code */
    public $srvCode;

    /** @var int */
    public $maxRetries;

    /** @var int Initial backoff in milliseconds */
    public $initialBackoffMs;

    /** @var string 'debug'|'info'|'warn'|'error' */
    public $logLevel;

    const BASE_URLS = [
        'test' => 'https://test1.e-collect.com/app_express/api',
        'prod' => 'https://www.e-collect.com/app_Express/api',
    ];

    const TRANSACTION_INFO_URLS = [
        'test' => 'https://test1.e-collect.com/app_express/api/getTransactionInformation',
        'prod' => 'https://m.e-collect.com/app_Express/api/GetTransactionInformation',
    ];

    /**
     * @param array<string, mixed> $options
     */
    public function __construct(array $options)
    {
        $this->apiKey          = $options['api_key']          ?? '';
        $this->etyCode         = (int)($options['ety_code']   ?? 0);
        $this->environment     = $options['environment']       ?? 'test';
        $this->srvCode         = isset($options['srv_code']) ? (int)$options['srv_code'] : null;
        $this->maxRetries      = (int)($options['max_retries']       ?? 3);
        $this->initialBackoffMs = (int)($options['initial_backoff_ms'] ?? 2000);
        $this->logLevel        = $options['log_level']         ?? 'info';
    }

    public function baseUrl(): string
    {
        return self::BASE_URLS[$this->environment] ?? self::BASE_URLS['test'];
    }

    public function transactionInfoUrl(): string
    {
        return self::TRANSACTION_INFO_URLS[$this->environment] ?? self::TRANSACTION_INFO_URLS['test'];
    }
}
