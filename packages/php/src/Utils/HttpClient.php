<?php

declare(strict_types=1);

namespace Ecollect\Utils;

use Ecollect\Exceptions\NetworkRetryableException;
use GuzzleHttp\Client;
use GuzzleHttp\Exception\RequestException;

/**
 * Guzzle-based HTTP client with retry logic and exponential backoff.
 */
class HttpClient
{
    /** @var Client */
    private $client;

    /** @var int */
    private $maxRetries;

    /** @var int Initial backoff in milliseconds */
    private $initialBackoffMs;

    /** @var string */
    private $logLevel;

    public function __construct(
        int $maxRetries = 3,
        int $initialBackoffMs = 2000,
        string $logLevel = 'info',
        ?Client $guzzleClient = null
    ) {
        $this->maxRetries       = $maxRetries;
        $this->initialBackoffMs = $initialBackoffMs;
        $this->logLevel         = $logLevel;
        $this->client           = $guzzleClient ?? new Client([
            'timeout'         => 30,
            'connect_timeout' => 10,
        ]);
    }

    /**
     * Send a POST request with JSON body, retrying on NetworkRetryableException.
     *
     * @param  string              $url
     * @param  array<string,mixed> $body
     * @return array<string,mixed>
     * @throws NetworkRetryableException|\Ecollect\Exceptions\EcollectException
     */
    public function post(string $url, array $body): array
    {
        $attempt   = 0;
        $lastError = null;

        while ($attempt <= $this->maxRetries) {
            try {
                $this->log('debug', "POST {$url} (attempt " . ($attempt + 1) . ')');

                $response = $this->client->post($url, [
                    'json'    => $body,
                    'headers' => ['Accept' => 'application/json'],
                ]);

                $data = json_decode((string)$response->getBody(), true);
                $this->log('debug', "Response from {$url}: " . json_encode($data));

                return $data ?? [];
            } catch (RequestException $e) {
                $statusCode = $e->getResponse() ? $e->getResponse()->getStatusCode() : 0;
                $this->log('warn', "HTTP {$statusCode} from {$url}: " . $e->getMessage());

                if ($attempt < $this->maxRetries) {
                    $backoffMs = $this->initialBackoffMs * (int)pow(2, $attempt);
                    $this->log('info', "Retrying in {$backoffMs}ms…");
                    usleep($backoffMs * 1000);
                    $attempt++;
                    $lastError = new NetworkRetryableException("HTTP {$statusCode}: " . $e->getMessage());
                    continue;
                }

                throw new NetworkRetryableException("HTTP {$statusCode}: " . $e->getMessage());
            } catch (NetworkRetryableException $e) {
                if ($attempt < $this->maxRetries) {
                    $backoffMs = $this->initialBackoffMs * (int)pow(2, $attempt);
                    $this->log('warn', "Retryable error, retrying in {$backoffMs}ms…");
                    usleep($backoffMs * 1000);
                    $attempt++;
                    $lastError = $e;
                    continue;
                }
                throw $e;
            }
        }

        throw $lastError ?? new NetworkRetryableException('Max retries exceeded');
    }

    private function log(string $level, string $message): void
    {
        $levels = ['debug' => 0, 'info' => 1, 'warn' => 2, 'error' => 3];
        $minLevel = $levels[$this->logLevel] ?? 1;
        $msgLevel = $levels[$level]          ?? 1;

        if ($msgLevel >= $minLevel) {
            error_log("[ecollect-sdk] {$message}");
        }
    }
}
