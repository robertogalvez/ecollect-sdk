/**
 * WebhooksModule: verify webhook signatures and confirm webhooks via ecollect API.
 */

import { mapReturnCodeToError, WebhookValidationException } from '../errors/index.js';
import type { EcollectConfig } from '../config.js';
import { BASE_URLS } from '../config.js';
import type {
  VerifySessionTokenRequest,
  VerifySessionTokenResponse,
  WebhookPayload,
} from '../types/api.js';
import type { TransactionResult } from '../types/index.js';
import type { HttpClient } from '../utils/http.js';
import type { SessionModule } from './session.js';
import { hmacSha256, timingSafeEqual } from '../utils/crypto.js';

export class WebhooksModule {
  private readonly config: EcollectConfig;
  private readonly http: HttpClient;
  private readonly session: SessionModule;

  constructor(config: EcollectConfig, http: HttpClient, session: SessionModule) {
    this.config = config;
    this.http = http;
    this.session = session;
  }

  /**
   * Verify HMAC-SHA256 signature of a webhook payload.
   * The signature is computed over `JSON.stringify(payload)` with `secret`.
   */
  async verifyWebhookSignature(
    payload: Record<string, unknown>,
    signature: string,
    secret: string,
  ): Promise<boolean> {
    const expected = await hmacSha256(JSON.stringify(payload), secret);
    return timingSafeEqual(expected, signature.toLowerCase());
  }

  /**
   * Confirm a webhook by verifying the SessionToken via ecollect API.
   * Uses verifySessionToken endpoint to ensure authenticity.
   */
  async confirmWebhook(
    payload: WebhookPayload,
    sessionToken: string,
  ): Promise<TransactionResult> {
    if (!payload.SessionToken) {
      throw new WebhookValidationException('Webhook payload is missing SessionToken');
    }
    if (!payload.TicketId) {
      throw new WebhookValidationException('Webhook payload is missing TicketId');
    }

    const url = `${BASE_URLS[this.config.environment]}/verifySessionToken`;
    const activeToken = sessionToken || (await this.session.getActive());

    const body: VerifySessionTokenRequest = {
      EntityCode: this.config.etyCode,
      SessionToken: activeToken,
      SessionTokenToVerify: payload.SessionToken,
      TicketIdToVerify: payload.TicketId,
    };

    const res = await this.http.post<VerifySessionTokenRequest, VerifySessionTokenResponse>(
      url,
      body,
    );

    if (res.ReturnCode !== 'SUCCESS') {
      throw mapReturnCodeToError(res.ReturnCode, `verifySessionToken failed: ${res.ReturnCode}`);
    }

    // Return the transaction data from the webhook payload
    return {
      returnCode: payload.ReturnCode,
      ticketId: payload.TicketId,
      tranState: payload.TranState as TransactionResult['tranState'],
      trazabilityCode: payload.TrazabilityCode,
      transValue: payload.TransValue,
      transVatValue: payload.TransVatValue,
      payCurrency: payload.PayCurrency,
      bankProcessDate: payload.BankProcessDate,
      fiCode: payload.FICode,
      fiName: payload.FiName,
      paymentSystem: payload.PaymentSystem,
      referenceArray: payload.ReferenceArray,
      srvCode: payload.SrvCode,
    };
  }

  /**
   * Build the response body that ecollect expects from a webhook endpoint.
   */
  static buildWebhookResponse(success: boolean): { ReturnCode: string } {
    return { ReturnCode: success ? 'SUCCESS' : 'FAIL_SYSTEM' };
  }
}
