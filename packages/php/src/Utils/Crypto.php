<?php

declare(strict_types=1);

namespace Ecollect\Utils;

/**
 * HMAC-SHA256 helpers for webhook signature verification.
 */
class Crypto
{
    /**
     * Compute HMAC-SHA256 of a message using a secret key.
     * Returns a lowercase hex-encoded string.
     */
    public static function hmacSha256(string $message, string $secret): string
    {
        return hash_hmac('sha256', $message, $secret);
    }

    /**
     * Constant-time string comparison to prevent timing attacks.
     */
    public static function timingSafeEqual(string $a, string $b): bool
    {
        return hash_equals($a, $b);
    }
}
