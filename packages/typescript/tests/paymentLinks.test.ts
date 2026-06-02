import { PaymentLinksModule } from '../src/modules/paymentLinks';
import { PaymentsModule } from '../src/modules/payments';
import { SessionModule } from '../src/modules/session';
import { HttpClient } from '../src/utils/http';
import { SessionExpiredException } from '../src/errors/index';
import type { EcollectConfig } from '../src/config';
import type { PaymentIntent } from '../src/types/index';

jest.mock('../src/utils/http');
jest.mock('../src/modules/session');
jest.mock('../src/modules/payments');

const mockConfig: EcollectConfig = {
  apiKey: 'test-api-key',
  etyCode: 12345,
  environment: 'test',
  srvCode: 1,
};

const baseIntent: PaymentIntent = {
  amount: 50000,
  currency: 'COP',
  srvCode: 1,
  customer: {
    fullName: 'Ana García',
    email: 'ana@example.com',
    documentType: 'CC',
    documentNumber: '87654321',
    mobileCountryCode: '57',
    mobileNumber: '3109876543',
  },
};

function makePaymentLinksModule(processWithExtraInfoFn: jest.Mock) {
  const httpInst = new (HttpClient as unknown as new (o: unknown) => { post: jest.Mock })({});
  httpInst.post = jest.fn();

  const sessionInst = new (SessionModule as unknown as new (c: unknown, h: unknown) => {
    getActive: jest.Mock;
    invalidate: jest.Mock;
  })(mockConfig, httpInst);
  sessionInst.getActive = jest.fn().mockResolvedValue('tok_session');
  sessionInst.invalidate = jest.fn();

  const paymentsInst = new (PaymentsModule as unknown as new (c: unknown, h: unknown, s: unknown) => {
    _processWithExtraInfo: jest.Mock;
  })(mockConfig, httpInst, sessionInst);
  paymentsInst._processWithExtraInfo = processWithExtraInfoFn;

  return new PaymentLinksModule(paymentsInst as unknown as PaymentsModule);
}

describe('PaymentLinksModule', () => {
  describe('generatePaymentLink()', () => {
    it('returns valid URL for email method', async () => {
      const processWithExtraInfoMock = jest.fn().mockResolvedValue({
        returnCode: 'SUCCESS',
        ticketId: 123,
        eCollectUrl: 'https://ecollect.example.com/link/abc',
        lifetimeSecs: 3600,
      });
      const links = makePaymentLinksModule(processWithExtraInfoMock);

      const result = await links.generatePaymentLink(baseIntent, 'email');
      expect(result.eCollectUrl).toBe('https://ecollect.example.com/link/abc');
      expect(result.ticketId).toBe(123);
      expect(result.lifetimeSecs).toBe(3600);
      expect(result.expiresAt).toBeInstanceOf(Date);
      expect(result.expiresAt.getTime()).toBeGreaterThan(Date.now());
    });

    it('generates link with optional amount and reference fields', async () => {
      const processWithExtraInfoMock = jest.fn().mockResolvedValue({
        returnCode: 'SUCCESS',
        ticketId: 456,
        eCollectUrl: 'https://ecollect.example.com/link/xyz',
        lifetimeSecs: 7200,
      });
      const links = makePaymentLinksModule(processWithExtraInfoMock);

      const intentWithExtras: PaymentIntent = {
        ...baseIntent,
        amount: 120000,
        currency: 'COP',
        merchantTransactionId: 'REF-2024-001',
      };

      const result = await links.generatePaymentLink(intentWithExtras, 'email');
      expect(result.eCollectUrl).toBe('https://ecollect.example.com/link/xyz');
      expect(result.ticketId).toBe(456);

      // Verify _processWithExtraInfo received intent with paymentSystem='10'
      const callArgs = processWithExtraInfoMock.mock.calls[0] as [PaymentIntent, unknown[]];
      expect(callArgs[0].paymentSystem).toBe('10');
    });

    it('throws when underlying payments module throws expired session error', async () => {
      const processWithExtraInfoMock = jest
        .fn()
        .mockRejectedValue(new SessionExpiredException());
      const links = makePaymentLinksModule(processWithExtraInfoMock);

      await expect(links.generatePaymentLink(baseIntent, 'email')).rejects.toThrow(
        SessionExpiredException,
      );
    });
  });
});
