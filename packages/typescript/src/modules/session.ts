/**
 * SessionModule: manages ecollect session tokens with caching and auto-refresh.
 */

import { mapReturnCodeToError, SessionExpiredException } from '../errors/index.js';
import type { EcollectConfig } from '../config.js';
import { BASE_URLS } from '../config.js';
import type { GetSessionTokenRequest, GetSessionTokenResponse } from '../types/api.js';
import type { SessionToken } from '../types/index.js';
import type { HttpClient } from '../utils/http.js';

/** Refresh proactively when less than this many seconds remain */
const PROACTIVE_REFRESH_THRESHOLD_SECS = 300;

export class SessionModule {
  private cached: SessionToken | null = null;
  private readonly config: EcollectConfig;
  private readonly http: HttpClient;

  constructor(config: EcollectConfig, http: HttpClient) {
    this.config = config;
    this.http = http;
  }

  /**
   * Create (or re-use) a session token. Fetches a new one from ecollect.
   */
  async create(): Promise<SessionToken> {
    this.cached = null;
    return this._fetchNew();
  }

  /**
   * Return cached session token, refreshing if < PROACTIVE_REFRESH_THRESHOLD_SECS remain.
   */
  async getActive(): Promise<string> {
    if (this.cached) {
      const remainingSecs = (this.cached.expiresAt.getTime() - Date.now()) / 1000;
      if (remainingSecs > PROACTIVE_REFRESH_THRESHOLD_SECS) {
        return this.cached.token;
      }
      // Proactive refresh
      this.cached = null;
    }
    const session = await this._fetchNew();
    return session.token;
  }

  /**
   * Force-invalidate cached token (e.g., after FAIL_APIEXPIREDSESSION).
   */
  invalidate(): void {
    this.cached = null;
  }

  private async _fetchNew(): Promise<SessionToken> {
    const url = `${BASE_URLS[this.config.environment]}/getSessionToken`;

    const body: GetSessionTokenRequest = {
      EntityCode: this.config.etyCode,
      ApiKey: this.config.apiKey,
    };

    const res = await this.http.post<GetSessionTokenRequest, GetSessionTokenResponse>(url, body);

    if (res.ReturnCode !== 'SUCCESS' || !res.SessionToken) {
      throw mapReturnCodeToError(res.ReturnCode, `getSessionToken failed: ${res.ReturnCode}`);
    }

    const lifetimeSecs = res.LifetimeSecs ?? 1800;
    const session: SessionToken = {
      token: res.SessionToken,
      lifetimeSecs,
      expiresAt: new Date(Date.now() + lifetimeSecs * 1000),
    };

    this.cached = session;
    return session;
  }
}
