import { WebhooksModule } from '../src/modules/webhooks';
import { SessionModule } from '../src/modules/session';
import { HttpClient } from '../src/utils/http';
import { WebhookValidationException } from '../src/errors/index';
import type { EcollectConfig } from '../src/config';
import type { WebhookPayload } from '../src/types/api';
import { hmacSha256 } from '../src/utils/crypto';

jest.mock('../src/utils/http');
jest.mock('../src/modules/session');

const mockConfig: EcollectConfig = {
  apiKey: 'test-key',
  etyCode: 12345,
  environment: 'test',
};

function makeWebhooksModule(postFn: jest.Mock) {
  const httpInst = new (HttpClient as unknown as new (o: unknown) => { post: jest.Mock })({});
  httpInst.post = postFn;

  const sessionInst = new (SessionModule as unknown as new (c: unknown, h: unknown) => {
    getActive: jest.Mock;
  })(mockConfig, httpInst);
  sessionInst.getActive = jest.fn().mockResolvedValue('tok_session');

  return new WebhooksModule(
    mockConfig,
    httpInst as unknown as HttpClient,
    sessionInst as unknown as SessionModule,
  );
}

describe('WebhooksModule', () => {
  describe('verifyWebhookSignature()', () => {
    it('returns true for valid signature', async () => {
      const webhooks = makeWebhooksModule(jest.fn());
      const payload = { ticketId: 123, tranState: 'OK' };
      const secret = 'my-webhook-secret';
      const signature = await hmacSha256(JSON.stringify(payload), secret);

      const valid = await webhooks.verifyWebhookSignature(payload, signature, secret);
      expect(valid).toBe(true);
    });

    it('returns false for invalid signature', async () => {
      const webhooks = makeWebhooksModule(jest.fn());
      const payload = { ticketId: 123, tranState: 'OK' };

      const valid = await webhooks.verifyWebhookSignature(payload, 'wrong-sig', 'secret');
      expect(valid).toBe(false);
    });

    it('returns false for signature of tampered payload', async () => {
      const webhooks = makeWebhooksModule(jest.fn());
      const originalPayload = { ticketId: 123, tranState: 'OK' };
      const tamperedPayload = { ticketId: 456, tranState: 'NOT_AUTHORIZED' };
      const secret = 'my-secret';
      const signature = await hmacSha256(JSON.stringify(originalPayload), secret);

      const valid = await webhooks.verifyWebhookSignature(tamperedPayload, signature, secret);
      expect(valid).toBe(false);
    });
  });

  describe('confirmWebhook()', () => {
    it('confirms a valid webhook via API', async () => {
      const postMock = jest.fn().mockResolvedValue({ ReturnCode: 'SUCCESS' });
      const webhooks = makeWebhooksModule(postMock);

      const webhookPayload: WebhookPayload = {
        ReturnCode: 'SUCCESS',
        TicketId: 999,
        TranState: 'OK',
        SessionToken: 'tok_original',
        TransValue: 100,
      };

      const result = await webhooks.confirmWebhook(webhookPayload, 'tok_active');
      expect(result.ticketId).toBe(999);
      expect(result.tranState).toBe('OK');
    });

    it('throws WebhookValidationException when SessionToken missing', async () => {
      const webhooks = makeWebhooksModule(jest.fn());
      const payload: WebhookPayload = {
        ReturnCode: 'SUCCESS',
        TicketId: 999,
        TranState: 'OK',
        // No SessionToken
      };

      await expect(webhooks.confirmWebhook(payload, 'tok')).rejects.toThrow(
        WebhookValidationException,
      );
    });

    it('throws WebhookValidationException when TicketId missing', async () => {
      const webhooks = makeWebhooksModule(jest.fn());
      const payload: WebhookPayload = {
        ReturnCode: 'SUCCESS',
        SessionToken: 'tok_original',
        TranState: 'OK',
        // No TicketId
      };

      await expect(webhooks.confirmWebhook(payload, 'tok')).rejects.toThrow(
        WebhookValidationException,
      );
    });

    it('throws on FAIL_SESSIONNOTFOUND', async () => {
      const postMock = jest.fn().mockResolvedValue({ ReturnCode: 'FAIL_SESSIONNOTFOUND' });
      const webhooks = makeWebhooksModule(postMock);

      const payload: WebhookPayload = {
        ReturnCode: 'SUCCESS',
        TicketId: 999,
        TranState: 'OK',
        SessionToken: 'bad_session',
      };

      await expect(webhooks.confirmWebhook(payload, 'tok_active')).rejects.toThrow(
        WebhookValidationException,
      );
    });

    it('throws on FAIL_TICKETIDNOTMATCH', async () => {
      const postMock = jest.fn().mockResolvedValue({ ReturnCode: 'FAIL_TICKETIDNOTMATCH' });
      const webhooks = makeWebhooksModule(postMock);

      const payload: WebhookPayload = {
        ReturnCode: 'SUCCESS',
        TicketId: 999,
        TranState: 'OK',
        SessionToken: 'tok_original',
      };

      await expect(webhooks.confirmWebhook(payload, 'tok_active')).rejects.toThrow(
        WebhookValidationException,
      );
    });
  });

  describe('buildWebhookResponse()', () => {
    it('returns SUCCESS response', () => {
      const response = WebhooksModule.buildWebhookResponse(true);
      expect(response.ReturnCode).toBe('SUCCESS');
    });

    it('returns FAIL_SYSTEM response', () => {
      const response = WebhooksModule.buildWebhookResponse(false);
      expect(response.ReturnCode).toBe('FAIL_SYSTEM');
    });
  });
});
