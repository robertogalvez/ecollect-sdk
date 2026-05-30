import type { Environment, LogLevel } from './types/index.js';

export interface EcollectConfig {
  apiKey: string;
  etyCode: number;
  environment: Environment;
  /** Default service code (can be overridden per PaymentIntent) */
  srvCode?: number;
  logLevel?: LogLevel;
  /** Maximum HTTP retries for retryable errors */
  maxRetries?: number;
  /** Initial backoff delay in ms */
  initialBackoffMs?: number;
}

export const DEFAULT_CONFIG = {
  environment: 'test' as Environment,
  logLevel: 'info' as LogLevel,
  maxRetries: 3,
  initialBackoffMs: 2000,
} as const;

export const BASE_URLS: Record<Environment, string> = {
  test: 'https://test1.e-collect.com/app_express/api',
  prod: 'https://www.e-collect.com/app_Express/api',
};

/**
 * The prod GetTransactionInformation uses a different subdomain.
 */
export const TRANSACTION_INFO_URLS: Record<Environment, string> = {
  test: 'https://test1.e-collect.com/app_express/api/getTransactionInformation',
  prod: 'https://m.e-collect.com/app_Express/api/GetTransactionInformation',
};

export function resolvedConfig(config: EcollectConfig): Required<EcollectConfig> {
  return {
    ...DEFAULT_CONFIG,
    srvCode: 0,
    ...config,
    maxRetries: config.maxRetries ?? DEFAULT_CONFIG.maxRetries,
    initialBackoffMs: config.initialBackoffMs ?? DEFAULT_CONFIG.initialBackoffMs,
    logLevel: config.logLevel ?? DEFAULT_CONFIG.logLevel,
  };
}
