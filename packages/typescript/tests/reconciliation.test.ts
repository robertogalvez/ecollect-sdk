import { ReconciliationModule } from '../src/modules/reconciliation';
import { SessionModule } from '../src/modules/session';
import { HttpClient } from '../src/utils/http';
import { PollingTimeoutException } from '../src/errors/index';
import type { EcollectConfig } from '../src/config';

jest.mock('../src/utils/http');
jest.mock('../src/modules/session');

const mockConfig: EcollectConfig = {
  apiKey: 'test-api-key',
  etyCode: 12345,
  environment: 'test',
};

function makeReconciliationModule(postFn: jest.Mock) {
  const httpInst = new (HttpClient as unknown as new (o: unknown) => { post: jest.Mock })({});
  httpInst.post = postFn;

  const sessionInst = new (SessionModule as unknown as new (c: unknown, h: unknown) => {
    getActive: jest.Mock;
    invalidate: jest.Mock;
  })(mockConfig, httpInst);
  sessionInst.getActive = jest.fn().mockResolvedValue('tok_session');
  sessionInst.invalidate = jest.fn();

  return new ReconciliationModule(
    mockConfig,
    httpInst as unknown as HttpClient,
    sessionInst as unknown as SessionModule,
  );
}

describe('ReconciliationModule', () => {
  describe('getTransactionStatus()', () => {
    it('returns OK status for an approved transaction', async () => {
      const postMock = jest.fn().mockResolvedValue({
        ReturnCode: 'SUCCESS',
        TicketId: 999,
        TranState: 'OK',
        TrazabilityCode: 'TRAZ-001',
        TransValue: 100000,
        PayCurrency: 'COP',
      });
      const reconciliation = makeReconciliationModule(postMock);

      const result = await reconciliation.getTransactionStatus(999);
      expect(result.returnCode).toBe('SUCCESS');
      expect(result.ticketId).toBe(999);
      expect(result.tranState).toBe('OK');
      expect(result.trazabilityCode).toBe('TRAZ-001');
    });

    it('returns PENDING status for an in-progress transaction', async () => {
      const postMock = jest.fn().mockResolvedValue({
        ReturnCode: 'SUCCESS',
        TicketId: 777,
        TranState: 'PENDING',
      });
      const reconciliation = makeReconciliationModule(postMock);

      const result = await reconciliation.getTransactionStatus(777);
      expect(result.tranState).toBe('PENDING');
      expect(result.ticketId).toBe(777);
    });
  });

  describe('reconciliate()', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });
    afterEach(() => {
      jest.useRealTimers();
    });

    it('resolves when transaction reaches final state after 2 polls', async () => {
      const postMock = jest
        .fn()
        .mockResolvedValueOnce({
          ReturnCode: 'SUCCESS',
          TicketId: 100,
          TranState: 'PENDING',
        })
        .mockResolvedValueOnce({
          ReturnCode: 'SUCCESS',
          TicketId: 100,
          TranState: 'OK',
          TrazabilityCode: 'TRAZ-FINAL',
        });
      const reconciliation = makeReconciliationModule(postMock);

      const promise = reconciliation.reconciliate(100, 120_000);

      // Drain first immediate poll (delay=0) then the 30s timer for second poll
      await jest.runAllTimersAsync();

      const result = await promise;
      expect(result.tranState).toBe('OK');
      expect(result.trazabilityCode).toBe('TRAZ-FINAL');
      expect(postMock).toHaveBeenCalledTimes(2);
    });

    it('throws PollingTimeoutException when timeout is exceeded', async () => {
      const postMock = jest.fn().mockResolvedValue({
        ReturnCode: 'SUCCESS',
        TicketId: 200,
        TranState: 'PENDING',
      });
      const reconciliation = makeReconciliationModule(postMock);

      // timeout=100ms, poll interval for PENDING is 30s → timeout fires first
      const promise = reconciliation.reconciliate(200, 100);

      const [settled] = await Promise.allSettled([
        promise,
        jest.runAllTimersAsync(),
      ]);

      expect(settled!.status).toBe('rejected');
      expect((settled as PromiseRejectedResult).reason).toBeInstanceOf(PollingTimeoutException);
    });

    it('uses 30s interval between polls for PENDING state', async () => {
      const postMock = jest
        .fn()
        .mockResolvedValueOnce({
          ReturnCode: 'SUCCESS',
          TicketId: 300,
          TranState: 'PENDING',
        })
        .mockResolvedValueOnce({
          ReturnCode: 'SUCCESS',
          TicketId: 300,
          TranState: 'OK',
        });
      const reconciliation = makeReconciliationModule(postMock);

      const promise = reconciliation.reconciliate(300, 120_000);

      // Drain all timers: first poll fires at 0ms, second at 30s
      await jest.runAllTimersAsync();

      const result = await promise;
      // Both polls should have been made – first returned PENDING, second OK
      expect(postMock).toHaveBeenCalledTimes(2);
      expect(result.tranState).toBe('OK');
    });
  });
});
