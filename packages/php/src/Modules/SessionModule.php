<?php

declare(strict_types=1);

namespace Ecollect\Modules;

use Ecollect\Config;
use Ecollect\Exceptions\SessionExpiredException;
use Ecollect\Utils\ErrorMapper;
use Ecollect\Utils\HttpClient;

/** Refresh proactively when less than this many seconds remain */
const PROACTIVE_REFRESH_THRESHOLD_SECS = 300;

/**
 * Manages ecollect session tokens with in-memory caching and auto-refresh.
 */
class SessionModule
{
    /** @var array{token: string, expiresAt: int, lifetimeSecs: int}|null */
    private $cached = null;

    /** @var Config */
    private $config;

    /** @var HttpClient */
    private $http;

    public function __construct(Config $config, HttpClient $http)
    {
        $this->config = $config;
        $this->http   = $http;
    }

    /**
     * Create (or re-use) a session token. Forces fetch of a new token from ecollect.
     *
     * @return array{token: string, expiresAt: int, lifetimeSecs: int}
     */
    public function create(): array
    {
        $this->cached = null;
        return $this->fetchNew();
    }

    /**
     * Return cached session token string, refreshing if < 300s remain.
     */
    public function getActive(): string
    {
        if ($this->cached !== null) {
            $remainingSecs = $this->cached['expiresAt'] - time();
            if ($remainingSecs > PROACTIVE_REFRESH_THRESHOLD_SECS) {
                return $this->cached['token'];
            }
            $this->cached = null;
        }

        $session = $this->fetchNew();
        return $session['token'];
    }

    /**
     * Force-invalidate cached token (e.g. after FAIL_APIEXPIREDSESSION).
     */
    public function invalidate(): void
    {
        $this->cached = null;
    }

    /**
     * @return array{token: string, expiresAt: int, lifetimeSecs: int}
     */
    private function fetchNew(): array
    {
        $url  = $this->config->baseUrl() . '/getSessionToken';
        $body = [
            'EntityCode' => $this->config->etyCode,
            'ApiKey'     => $this->config->apiKey,
        ];

        $res = $this->http->post($url, $body);

        if (($res['ReturnCode'] ?? '') !== 'SUCCESS' || empty($res['SessionToken'])) {
            throw ErrorMapper::map($res['ReturnCode'] ?? 'FAIL_SYSTEM', "getSessionToken failed");
        }

        $lifetimeSecs = (int)($res['LifetimeSecs'] ?? 1800);

        $session = [
            'token'        => $res['SessionToken'],
            'lifetimeSecs' => $lifetimeSecs,
            'expiresAt'    => time() + $lifetimeSecs,
        ];

        $this->cached = $session;
        return $session;
    }
}
