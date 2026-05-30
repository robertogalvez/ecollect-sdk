/**
 * HttpClient with retry logic and exponential backoff.
 * Uses native fetch (Node 18+).
 */

import { NetworkRetryableException, SessionExpiredException, mapReturnCodeToError } from '../errors/index.js';
import type { LogLevel } from '../types/index.js';

export interface HttpClientOptions {
  maxRetries: number;
  initialBackoffMs: number;
  logLevel: LogLevel;
}

function log(level: LogLevel, minLevel: LogLevel, ...args: unknown[]): void {
  const levels: LogLevel[] = ['debug', 'info', 'warn', 'error'];
  if (levels.indexOf(level) >= levels.indexOf(minLevel)) {
    // eslint-disable-next-line no-console
    console[level]('[ecollect-sdk]', ...args);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class HttpClient {
  private readonly options: HttpClientOptions;

  constructor(options: HttpClientOptions) {
    this.options = options;
  }

  async post<TReq, TRes>(url: string, body: TReq): Promise<TRes> {
    const { maxRetries, initialBackoffMs, logLevel } = this.options;

    let attempt = 0;
    let lastError: unknown;

    while (attempt <= maxRetries) {
      try {
        log('debug', logLevel, `POST ${url} (attempt ${attempt + 1})`);

        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });

        if (!response.ok) {
          const text = await response.text().catch(() => '');
          log('warn', logLevel, `HTTP ${response.status} from ${url}: ${text}`);
          // For non-2xx treat as retryable system error
          if (attempt < maxRetries) {
            const backoff = initialBackoffMs * Math.pow(2, attempt);
            log('info', logLevel, `Retrying in ${backoff}ms…`);
            await sleep(backoff);
            attempt++;
            continue;
          }
          throw new NetworkRetryableException(`HTTP ${response.status}: ${text}`);
        }

        const data = (await response.json()) as TRes;
        log('debug', logLevel, `Response from ${url}:`, data);
        return data;
      } catch (err) {
        // Don't retry session-expired or non-retryable errors
        if (err instanceof SessionExpiredException) {
          throw err;
        }
        if (err instanceof NetworkRetryableException && attempt < maxRetries) {
          const backoff = initialBackoffMs * Math.pow(2, attempt);
          log('warn', logLevel, `Retryable error, retrying in ${backoff}ms…`, err);
          lastError = err;
          await sleep(backoff);
          attempt++;
          continue;
        }
        // Re-throw non-retryable SDK errors
        if (err instanceof Error && !(err instanceof NetworkRetryableException)) {
          throw err;
        }
        lastError = err;
        if (attempt >= maxRetries) break;
        const backoff = initialBackoffMs * Math.pow(2, attempt);
        await sleep(backoff);
        attempt++;
      }
    }

    if (lastError instanceof Error) throw lastError;
    throw new NetworkRetryableException('Max retries exceeded');
  }

  /**
   * Post with auto-session-refresh support.
   * `sessionProvider` is called to get the current token;
   * if the API returns FAIL_APIEXPIREDSESSION it refreshes and retries once.
   */
  async postWithSession<TReq extends { SessionToken: string }, TRes extends { ReturnCode: string }>(
    url: string,
    body: TReq,
    sessionProvider: () => Promise<string>,
    onSessionRefresh?: () => void,
  ): Promise<TRes> {
    body.SessionToken = await sessionProvider();

    const res = await this.post<TReq, TRes>(url, body);

    if (res.ReturnCode === 'FAIL_APIEXPIREDSESSION') {
      // Refresh and retry once
      onSessionRefresh?.();
      body.SessionToken = await sessionProvider();
      const retried = await this.post<TReq, TRes>(url, body);
      if (retried.ReturnCode !== 'SUCCESS' && retried.ReturnCode !== 'NO_RECORDS' && retried.ReturnCode !== 'SUCCESS_ALREADY_CREATED') {
        throw mapReturnCodeToError(retried.ReturnCode);
      }
      return retried;
    }

    return res;
  }
}
