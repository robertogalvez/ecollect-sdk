/**
 * PollingManager: background polling for transaction status resolution.
 */

import { PollingTimeoutException } from '../errors/index.js';
import type { TransactionResult, TranState } from '../types/index.js';

const FINAL_STATES: TranState[] = ['OK', 'NOT_AUTHORIZED', 'EXPIRED', 'FAILED'];
const INTERMEDIATE_STATES: TranState[] = ['BANK', 'PENDING'];
const CREATED_STATE: TranState = 'CREATED';

const POLL_INTERVAL_INTERMEDIATE_MS = 30_000;  // 30s for BANK/PENDING
const POLL_INTERVAL_CREATED_MS = 300_000;       // 5min for CREATED

export type PollCallback = (result: TransactionResult) => void;
export type StatusFetcher = (ticketId: number) => Promise<TransactionResult>;

export class PollingManager {
  private readonly timers = new Map<number, ReturnType<typeof setTimeout>>();
  private readonly startTimes = new Map<number, number>();
  private readonly fetcher: StatusFetcher;

  constructor(fetcher: StatusFetcher) {
    this.fetcher = fetcher;
  }

  /**
   * Start polling for a ticketId.
   * Calls `onComplete` when a final state is reached or timeout is exceeded.
   */
  startPolling(
    ticketId: number,
    onComplete: PollCallback,
    timeout = 600_000,
  ): void {
    if (this.timers.has(ticketId)) return; // already polling
    this.startTimes.set(ticketId, Date.now());
    this._schedule(ticketId, onComplete, timeout, 0);
  }

  private _schedule(
    ticketId: number,
    onComplete: PollCallback,
    timeout: number,
    delayMs: number,
  ): void {
    const timer = setTimeout(() => {
      void this._poll(ticketId, onComplete, timeout);
    }, delayMs);
    this.timers.set(ticketId, timer);
  }

  private async _poll(
    ticketId: number,
    onComplete: PollCallback,
    timeout: number,
  ): Promise<void> {
    const startTime = this.startTimes.get(ticketId) ?? Date.now();
    const elapsed = Date.now() - startTime;

    if (elapsed >= timeout) {
      this.stopPolling(ticketId);
      onComplete({
        returnCode: 'POLLING_TIMEOUT',
        ticketId,
        tranState: 'FAILED',
      });
      return;
    }

    try {
      const result = await this.fetcher(ticketId);
      const state = result.tranState as TranState | undefined;

      if (state && FINAL_STATES.includes(state)) {
        this.stopPolling(ticketId);
        onComplete(result);
        return;
      }

      const nextDelay =
        state === CREATED_STATE ? POLL_INTERVAL_CREATED_MS : POLL_INTERVAL_INTERMEDIATE_MS;

      this._schedule(ticketId, onComplete, timeout, nextDelay);
    } catch {
      // On error, continue polling with intermediate interval
      this._schedule(ticketId, onComplete, timeout, POLL_INTERVAL_INTERMEDIATE_MS);
    }
  }

  /**
   * Stop polling for a specific ticketId.
   */
  stopPolling(ticketId: number): void {
    const timer = this.timers.get(ticketId);
    if (timer !== undefined) clearTimeout(timer);
    this.timers.delete(ticketId);
    this.startTimes.delete(ticketId);
  }

  /**
   * Stop all active polls.
   */
  stopAll(): void {
    for (const ticketId of this.timers.keys()) {
      this.stopPolling(ticketId);
    }
  }

  /**
   * Promise-based reconciliation helper.
   * Resolves when a final state is reached; rejects on timeout.
   */
  waitForFinalState(
    ticketId: number,
    timeout = 600_000,
  ): Promise<TransactionResult> {
    return new Promise((resolve, reject) => {
      this.startPolling(
        ticketId,
        (result) => {
          if (result.returnCode === 'POLLING_TIMEOUT') {
            reject(new PollingTimeoutException(String(ticketId)));
          } else {
            resolve(result);
          }
        },
        timeout,
      );
    });
  }
}
