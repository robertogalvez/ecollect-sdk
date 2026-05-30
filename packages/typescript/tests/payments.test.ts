import { PaymentsModule } from '../src/modules/payments';
import { SessionModule } from '../src/modules/session';
import { HttpClient } from '../src/utils/http';
import {
  ValidationException,
  DuplicateTransactionException,
  NetworkRetryableException,
} from '../src/errors/index';
import type { EcollectConfig } from '../src/config';
import type { PaymentIntent } from '../src/types/index';

jest.mock('../src/utils/http');
jest.mock('../src/modules/session');

const mockConfig: EcollectConfig = {
  apiKey: 'test-api-key',
  etyCode: 12345,
  environment: 'test',
  srvCode: 1,
};

const baseIntent: PaymentIntent = {
  amount: 100.0,
  currency: 'COP',
  srvCode: 1,
  customer: {
    fullName: 'Juan Pérez',
    email: 'juan@example.com',
    documentType: 'CC',
    documentNumber: '12345678',
    phone: '3001234567',
  },
  merchantTransactionId: 'ORDER-001',
};

function makePaymentsModule(postFn: jest.Mock) {
  const httpInst = new (HttpClient as unknown as new (o: unknown) => { post: jest.Mock })({});
  httpInst.post = postFn;

  const sessionInst = new (SessionModule as unknown as new (c: unknown, h: unknown) => {
    getActive: jest.Mock;
    invalidate: jest.Mock;
  })(mockConfig, httpInst);
  sessionInst.getActive = jest.fn().mockResolvedValue('tok_session');
  sessionInst.invalidate = jest.fn();

  return new PaymentsModule(
    mockConfig,
    httpInst as unknown as HttpClient,
    sessionInst as unknown as SessionModule,
  );
}

describe('PaymentsModule', () => {
  describe('process()', () => {
    it('processes a payment successfully', async () => {
      const postMock = jest.fn().mockResolvedValue({
        ReturnCode: 'SUCCESS',
        TicketId: 999,
        TransactionResponse: {
          ReturnCode: 'SUCCESS',
          TicketId: 999,
          TranState: 'OK',
        },
      });
      const payments = makePaymentsModule(postMock);

      const result = await payments.process(baseIntent);
      expect(result.ticketId).toBe(999);
      expect(result.returnCode).toBe('SUCCESS');
    });

    it('throws ValidationException for amount <= 0', async () => {
      const payments = makePaymentsModule(jest.fn());
      const badIntent = { ...baseIntent, amount: 0 };

      await expect(payments.process(badIntent)).rejects.toThrow(ValidationException);
    });

    it('throws ValidationException for invalid email', async () => {
      const payments = makePaymentsModule(jest.fn());
      const badIntent = {
        ...baseIntent,
        customer: { ...baseIntent.customer, email: 'not-an-email' },
      };

      await expect(payments.process(badIntent)).rejects.toThrow(ValidationException);
    });

    it('throws DuplicateTransactionException on FAIL_MERCHANTRANSID', async () => {
      const postMock = jest.fn().mockResolvedValue({
        ReturnCode: 'FAIL_MERCHANTRANSID',
      });
      const payments = makePaymentsModule(postMock);

      await expect(payments.process(baseIntent)).rejects.toThrow(DuplicateTransactionException);
    });

    it('throws NetworkRetryableException on FAIL_SYSTEM', async () => {
      const postMock = jest.fn().mockResolvedValue({
        ReturnCode: 'FAIL_SYSTEM',
      });
      const payments = makePaymentsModule(postMock);

      await expect(payments.process(baseIntent)).rejects.toThrow(NetworkRetryableException);
    });

    it('refreshes session on FAIL_APIEXPIREDSESSION and retries', async () => {
      const postMock = jest
        .fn()
        .mockResolvedValueOnce({ ReturnCode: 'FAIL_APIEXPIREDSESSION' })
        .mockResolvedValueOnce({
          ReturnCode: 'SUCCESS',
          TicketId: 777,
          TransactionResponse: { ReturnCode: 'SUCCESS', TicketId: 777, TranState: 'OK' },
        });
      const payments = makePaymentsModule(postMock);

      const result = await payments.process(baseIntent);
      expect(result.ticketId).toBe(777);
      expect(postMock).toHaveBeenCalledTimes(2);
    });
  });

  describe('double-payment prevention', () => {
    it('isDoublePaymentState returns true for BANK', () => {
      expect(PaymentsModule.isDoublePaymentState('BANK')).toBe(true);
    });

    it('isDoublePaymentState returns true for PENDING', () => {
      expect(PaymentsModule.isDoublePaymentState('PENDING')).toBe(true);
    });

    it('isDoublePaymentState returns true for CAPTURED', () => {
      expect(PaymentsModule.isDoublePaymentState('CAPTURED')).toBe(true);
    });

    it('isDoublePaymentState returns true for CREATED', () => {
      expect(PaymentsModule.isDoublePaymentState('CREATED')).toBe(true);
    });

    it('isDoublePaymentState returns false for OK', () => {
      expect(PaymentsModule.isDoublePaymentState('OK')).toBe(false);
    });

    it('isDoublePaymentState returns false for NOT_AUTHORIZED', () => {
      expect(PaymentsModule.isDoublePaymentState('NOT_AUTHORIZED')).toBe(false);
    });

    it('isDoublePaymentState returns false for FAILED', () => {
      expect(PaymentsModule.isDoublePaymentState('FAILED')).toBe(false);
    });
  });

  describe('preAuthorize()', () => {
    it('sends RequestType=1', async () => {
      const postMock = jest.fn().mockResolvedValue({
        ReturnCode: 'SUCCESS',
        TicketId: 500,
      });
      const payments = makePaymentsModule(postMock);

      await payments.preAuthorize(baseIntent);
      const callBody = postMock.mock.calls[0][1] as { RequestType: number };
      expect(callBody.RequestType).toBe(1);
    });
  });

  describe('capture()', () => {
    it('sends positive ticketId as RequestType', async () => {
      const postMock = jest.fn().mockResolvedValue({
        ReturnCode: 'SUCCESS',
        TicketId: 500,
      });
      const payments = makePaymentsModule(postMock);

      await payments.capture(500);
      const callBody = postMock.mock.calls[0][1] as { RequestType: number };
      expect(callBody.RequestType).toBe(500);
    });
  });

  describe('void()', () => {
    it('sends negative ticketId as RequestType', async () => {
      const postMock = jest.fn().mockResolvedValue({
        ReturnCode: 'SUCCESS',
        TicketId: 500,
      });
      const payments = makePaymentsModule(postMock);

      await payments.void(500);
      const callBody = postMock.mock.calls[0][1] as { RequestType: number };
      expect(callBody.RequestType).toBe(-500);
    });
  });

  describe('hostedCheckout()', () => {
    it('requires redirectUrl', async () => {
      const payments = makePaymentsModule(jest.fn());
      const intent = { ...baseIntent }; // no redirectUrl

      await expect(payments.hostedCheckout(intent)).rejects.toThrow(ValidationException);
    });

    it('returns eCollectUrl', async () => {
      const postMock = jest.fn().mockResolvedValue({
        ReturnCode: 'SUCCESS',
        TicketId: 123,
        eCollectUrl: 'https://ecollect.example.com/pay/123',
        LifetimeSecs: 900,
      });
      const payments = makePaymentsModule(postMock);

      const result = await payments.hostedCheckout({
        ...baseIntent,
        redirectUrl: 'https://merchant.example.com/confirm',
      });
      expect(result.eCollectUrl).toBe('https://ecollect.example.com/pay/123');
    });
  });
});
