<?php

declare(strict_types=1);

namespace Ecollect\Utils;

use Ecollect\Exceptions\PollingTimeoutException;

/**
 * Synchronous polling manager for transaction status resolution.
 *
 * PHP is synchronous, so this blocks the current execution context.
 * Use in background jobs (cron/queue) for best results.
 */
class Polling
{
    const FINAL_STATES        = ['OK', 'NOT_AUTHORIZED', 'EXPIRED', 'FAILED'];
    const POLL_INTERVAL_INTERMEDIATE_SECS = 30;
    const POLL_INTERVAL_CREATED_SECS      = 300;

    /**
     * Poll a transaction until a final state is reached or timeout expires.
     *
     * @param  int      $ticketId     ecollect ticket ID
     * @param  callable $fetcher      function(int $ticketId): array — calls getTransactionStatus
     * @param  int      $timeoutSecs  maximum time to wait (default: 600s / 10 min)
     * @return array<string,mixed>    final transaction result
     * @throws PollingTimeoutException
     */
    public static function waitForFinalState(
        int $ticketId,
        callable $fetcher,
        int $timeoutSecs = 600
    ): array {
        $startTime = time();

        while (true) {
            $elapsed = time() - $startTime;

            if ($elapsed >= $timeoutSecs) {
                throw new PollingTimeoutException($ticketId);
            }

            $result  = $fetcher($ticketId);
            $state   = $result['tranState'] ?? '';

            if (in_array($state, self::FINAL_STATES, true)) {
                return $result;
            }

            // CREATED state — wait longer
            $sleepSecs = ($state === 'CREATED')
                ? self::POLL_INTERVAL_CREATED_SECS
                : self::POLL_INTERVAL_INTERMEDIATE_SECS;

            // Respect timeout
            $remaining = $timeoutSecs - (time() - $startTime);
            if ($remaining <= 0) {
                throw new PollingTimeoutException($ticketId);
            }

            sleep(min($sleepSecs, (int)$remaining));
        }
    }
}
