import { SandboxInterceptor, SANDBOX_SCENARIOS, sandbox } from '../src/sandbox/index.js';

describe('SandboxInterceptor', () => {
  let interceptor: SandboxInterceptor;

  beforeEach(() => {
    interceptor = new SandboxInterceptor();
  });

  describe('SANDBOX_SCENARIOS', () => {
    it('should define all 10 scenarios', () => {
      const keys = Object.keys(SANDBOX_SCENARIOS);
      expect(keys).toHaveLength(10);
      expect(keys).toContain('PAYMENT_SUCCESS');
      expect(keys).toContain('PAYMENT_INSUFFICIENT_FUNDS');
      expect(keys).toContain('PAYMENT_INVALID_CARD');
      expect(keys).toContain('PAYMENT_BANK_PENDING');
      expect(keys).toContain('PAYMENT_TIMEOUT');
      expect(keys).toContain('PAYMENT_DUPLICATE');
      expect(keys).toContain('SESSION_EXPIRED');
      expect(keys).toContain('TOKEN_SAVE_SUCCESS');
      expect(keys).toContain('TOKEN_NOT_FOUND');
      expect(keys).toContain('WEBHOOK_VALID');
    });

    it('each scenario should have name and description', () => {
      for (const scenario of Object.values(SANDBOX_SCENARIOS)) {
        expect(typeof scenario.name).toBe('string');
        expect(scenario.name.length).toBeGreaterThan(0);
        expect(typeof scenario.description).toBe('string');
        expect(scenario.description.length).toBeGreaterThan(0);
      }
    });
  });

  describe('PAYMENT_SUCCESS scenario', () => {
    it('getSessionToken returns SUCCESS with token', async () => {
      interceptor.setScenario('PAYMENT_SUCCESS');
      const mockFetch = interceptor.getMockFetch();
      const res = await mockFetch('https://api.ecollect.com/getSessionToken', { method: 'POST', body: '{}' });
      const data = await res.json() as Record<string, unknown>;
      expect(data.ReturnCode).toBe('SUCCESS');
      expect(data.SessionToken).toBe('sandbox_session_token_mock_12345');
      expect(data.LifetimeSecs).toBe(1800);
    });

    it('createTransactionPayment returns OK TranState', async () => {
      interceptor.setScenario('PAYMENT_SUCCESS');
      const mockFetch = interceptor.getMockFetch();
      const res = await mockFetch('https://api.ecollect.com/createTransactionPayment', { method: 'POST', body: '{}' });
      const data = await res.json() as Record<string, unknown>;
      expect(data.ReturnCode).toBe('SUCCESS');
      expect(data.TicketId).toBe(999001);
      const txn = data.TransactionResponse as Record<string, unknown>;
      expect(txn.TranState).toBe('OK');
    });
  });

  describe('PAYMENT_INSUFFICIENT_FUNDS scenario', () => {
    it('createTransactionPayment returns NOT_AUTHORIZED', async () => {
      interceptor.setScenario('PAYMENT_INSUFFICIENT_FUNDS');
      const mockFetch = interceptor.getMockFetch();
      const res = await mockFetch('https://api.ecollect.com/createTransactionPayment', { method: 'POST', body: '{}' });
      const data = await res.json() as Record<string, unknown>;
      expect(data.ReturnCode).toBe('SUCCESS');
      const txn = data.TransactionResponse as Record<string, unknown>;
      expect(txn.TranState).toBe('NOT_AUTHORIZED');
    });
  });

  describe('PAYMENT_INVALID_CARD scenario', () => {
    it('createTransactionPayment returns FAIL_INVALIDCREDITCARD', async () => {
      interceptor.setScenario('PAYMENT_INVALID_CARD');
      const mockFetch = interceptor.getMockFetch();
      const res = await mockFetch('https://api.ecollect.com/createTransactionPayment', { method: 'POST', body: '{}' });
      const data = await res.json() as Record<string, unknown>;
      expect(data.ReturnCode).toBe('FAIL_INVALIDCREDITCARD');
    });
  });

  describe('PAYMENT_BANK_PENDING scenario', () => {
    it('createTransactionPayment returns BANK TranState', async () => {
      interceptor.setScenario('PAYMENT_BANK_PENDING');
      const mockFetch = interceptor.getMockFetch();
      const res = await mockFetch('https://api.ecollect.com/createTransactionPayment', { method: 'POST', body: '{}' });
      const data = await res.json() as Record<string, unknown>;
      const txn = data.TransactionResponse as Record<string, unknown>;
      expect(txn.TranState).toBe('BANK');
    });

    it('getTransactionInformation returns PENDING state', async () => {
      interceptor.setScenario('PAYMENT_BANK_PENDING');
      const mockFetch = interceptor.getMockFetch();
      const res = await mockFetch('https://api.ecollect.com/getTransactionInformation', { method: 'POST', body: '{}' });
      const data = await res.json() as Record<string, unknown>;
      expect(data.TranState).toBe('PENDING');
    });
  });

  describe('PAYMENT_TIMEOUT scenario', () => {
    it('createTransactionPayment returns FAIL_SYSTEM', async () => {
      interceptor.setScenario('PAYMENT_TIMEOUT');
      const mockFetch = interceptor.getMockFetch();
      const res = await mockFetch('https://api.ecollect.com/createTransactionPayment', { method: 'POST', body: '{}' });
      const data = await res.json() as Record<string, unknown>;
      expect(data.ReturnCode).toBe('FAIL_SYSTEM');
    });
  });

  describe('PAYMENT_DUPLICATE scenario', () => {
    it('createTransactionPayment returns FAIL_MERCHANTRANSID', async () => {
      interceptor.setScenario('PAYMENT_DUPLICATE');
      const mockFetch = interceptor.getMockFetch();
      const res = await mockFetch('https://api.ecollect.com/createTransactionPayment', { method: 'POST', body: '{}' });
      const data = await res.json() as Record<string, unknown>;
      expect(data.ReturnCode).toBe('FAIL_MERCHANTRANSID');
    });
  });

  describe('SESSION_EXPIRED scenario', () => {
    it('getSessionToken returns FAIL_APIEXPIREDSESSION', async () => {
      interceptor.setScenario('SESSION_EXPIRED');
      const mockFetch = interceptor.getMockFetch();
      const res = await mockFetch('https://api.ecollect.com/getSessionToken', { method: 'POST', body: '{}' });
      const data = await res.json() as Record<string, unknown>;
      expect(data.ReturnCode).toBe('FAIL_APIEXPIREDSESSION');
    });
  });

  describe('TOKEN_SAVE_SUCCESS scenario', () => {
    it('tokenCommand returns SUCCESS with TokenId', async () => {
      interceptor.setScenario('TOKEN_SAVE_SUCCESS');
      const mockFetch = interceptor.getMockFetch();
      const res = await mockFetch('https://api.ecollect.com/tokenCommand', {
        method: 'POST',
        body: JSON.stringify({ Command: 'ADD' }),
      });
      const data = await res.json() as Record<string, unknown>;
      expect(data.ReturnCode).toBe('SUCCESS');
      const tokens = data.TokenInfoArray as Array<Record<string, unknown>>;
      expect(tokens).toHaveLength(3);
      expect(tokens[0].AttributeValue).toBe('sandbox_token_mock_67890');
    });

    it('queryToken returns ACTIVE token', async () => {
      interceptor.setScenario('TOKEN_SAVE_SUCCESS');
      const mockFetch = interceptor.getMockFetch();
      const res = await mockFetch('https://api.ecollect.com/queryToken', { method: 'POST', body: '{}' });
      const data = await res.json() as Record<string, unknown>;
      expect(data.ReturnCode).toBe('SUCCESS');
      const tokenArray = data.TokenArray as Array<Record<string, unknown>>;
      expect(tokenArray[0].TokenStatus).toBe('ACTIVE');
    });
  });

  describe('TOKEN_NOT_FOUND scenario', () => {
    it('tokenCommand REMOVE returns FAIL_TOKENNOTFOUND', async () => {
      interceptor.setScenario('TOKEN_NOT_FOUND');
      const mockFetch = interceptor.getMockFetch();
      const res = await mockFetch('https://api.ecollect.com/tokenCommand', {
        method: 'POST',
        body: JSON.stringify({ Command: 'REMOVE' }),
      });
      const data = await res.json() as Record<string, unknown>;
      expect(data.ReturnCode).toBe('FAIL_TOKENNOTFOUND');
    });
  });

  describe('WEBHOOK_VALID scenario', () => {
    it('verifySessionToken returns SUCCESS', async () => {
      interceptor.setScenario('WEBHOOK_VALID');
      const mockFetch = interceptor.getMockFetch();
      const res = await mockFetch('https://api.ecollect.com/verifySessionToken', { method: 'POST', body: '{}' });
      const data = await res.json() as Record<string, unknown>;
      expect(data.ReturnCode).toBe('SUCCESS');
    });
  });

  describe('getPaymentSystem and getCustomerId', () => {
    it('getPaymentSystem returns payment systems', async () => {
      const mockFetch = interceptor.getMockFetch();
      const res = await mockFetch('https://api.ecollect.com/getPaymentSystem', { method: 'POST', body: '{}' });
      const data = await res.json() as Record<string, unknown>;
      expect(data.ReturnCode).toBe('SUCCESS');
      const systems = data.PaymentSystemArray as Array<Record<string, unknown>>;
      expect(systems).toHaveLength(2);
    });

    it('getCustomerId returns customer info', async () => {
      const mockFetch = interceptor.getMockFetch();
      const res = await mockFetch('https://api.ecollect.com/getCustomerId', { method: 'POST', body: '{}' });
      const data = await res.json() as Record<string, unknown>;
      expect(data.ReturnCode).toBe('SUCCESS');
      const info = data.CustomerInfoArray as Array<Record<string, unknown>>;
      expect(info[0].AttributeValue).toBe('cust_sandbox_001');
    });
  });

  describe('default singleton export', () => {
    it('sandbox is a SandboxInterceptor instance', () => {
      expect(sandbox).toBeInstanceOf(SandboxInterceptor);
    });
  });
});
