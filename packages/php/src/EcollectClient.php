<?php

declare(strict_types=1);

namespace Ecollect;

use Ecollect\Exceptions\InvalidConfigException;
use Ecollect\Modules\CustomersModule;
use Ecollect\Modules\PaymentLinksModule;
use Ecollect\Modules\PaymentsModule;
use Ecollect\Modules\PaymentSystemsModule;
use Ecollect\Modules\ReconciliationModule;
use Ecollect\Modules\SessionModule;
use Ecollect\Modules\TokensModule;
use Ecollect\Modules\WebhooksModule;
use Ecollect\Utils\HttpClient;

/**
 * Main entry point for the ecollect PHP SDK.
 *
 * Usage:
 * ```php
 * use Ecollect\EcollectClient;
 *
 * $client = new EcollectClient([
 *     'api_key'     => 'your-api-key',
 *     'ety_code'    => 123,
 *     'environment' => 'test',
 *     'srv_code'    => 456, // optional default
 * ]);
 *
 * $token   = $client->session->create();
 * $payment = $client->payments->process($paymentIntent);
 * ```
 */
class EcollectClient
{
    /** @var SessionModule */
    public $session;

    /** @var PaymentsModule */
    public $payments;

    /** @var TokensModule */
    public $tokens;

    /** @var WebhooksModule */
    public $webhooks;

    /** @var ReconciliationModule */
    public $reconciliation;

    /** @var CustomersModule */
    public $customers;

    /** @var PaymentSystemsModule */
    public $paymentSystems;

    /** @var PaymentLinksModule */
    public $paymentLinks;

    /** @var Config */
    private $config;

    /**
     * @param  array<string, mixed> $options
     *   - api_key      (string)  Required. Private API key
     *   - ety_code     (int)     Required. Entity/Merchant code
     *   - environment  (string)  Required. 'test' or 'prod'
     *   - srv_code     (int)     Optional. Default service code
     *   - max_retries  (int)     Optional. Default: 3
     *   - initial_backoff_ms (int) Optional. Default: 2000
     *   - log_level    (string)  Optional. 'debug'|'info'|'warn'|'error'. Default: 'info'
     * @throws InvalidConfigException
     */
    public function __construct(array $options)
    {
        $this->validateOptions($options);

        $this->config = new Config($options);

        $http = new HttpClient(
            $this->config->maxRetries,
            $this->config->initialBackoffMs,
            $this->config->logLevel
        );

        $this->session         = new SessionModule($this->config, $http);
        $this->payments        = new PaymentsModule($this->config, $http, $this->session);
        $this->tokens          = new TokensModule($this->config, $http, $this->session);
        $this->webhooks        = new WebhooksModule($this->config, $http, $this->session);
        $this->reconciliation  = new ReconciliationModule($this->config, $http, $this->session);
        $this->customers       = new CustomersModule($this->config, $http, $this->session);
        $this->paymentSystems  = new PaymentSystemsModule($this->config, $http, $this->session);
        $this->paymentLinks    = new PaymentLinksModule($this->payments);
    }

    /**
     * @param  array<string, mixed> $options
     * @throws InvalidConfigException
     */
    private function validateOptions(array $options): void
    {
        if (empty($options['api_key']) || trim((string)$options['api_key']) === '') {
            throw new InvalidConfigException('api_key is required');
        }

        if (empty($options['ety_code']) || (int)$options['ety_code'] <= 0) {
            throw new InvalidConfigException('ety_code must be a positive integer');
        }

        $env = $options['environment'] ?? '';
        if ($env !== 'test' && $env !== 'prod') {
            throw new InvalidConfigException('environment must be "test" or "prod"');
        }
    }
}
