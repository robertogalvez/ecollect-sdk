/**
 * ecollect SDK Sandbox Module
 *
 * Intercepts HTTP calls and returns mock responses WITHOUT calling real ecollect servers.
 * Use this module in tests and development to simulate all payment scenarios.
 */

export interface SandboxScenario {
  name: string;
  description: string;
}

export const SANDBOX_SCENARIOS: Record<string, SandboxScenario> = {
  PAYMENT_SUCCESS: { name: 'Payment Success', description: 'Transaction approved, returns OK state' },
  PAYMENT_INSUFFICIENT_FUNDS: { name: 'Insufficient Funds', description: 'Returns NOT_AUTHORIZED' },
  PAYMENT_INVALID_CARD: { name: 'Invalid Card', description: 'FAIL_INVALIDCREDITCARD error' },
  PAYMENT_BANK_PENDING: { name: 'Bank Pending', description: 'Returns BANK state (requires polling)' },
  PAYMENT_TIMEOUT: { name: 'Network Timeout', description: 'Simulates timeout, tests retry logic' },
  PAYMENT_DUPLICATE: { name: 'Duplicate Transaction', description: 'FAIL_MERCHANTRANSID error' },
  SESSION_EXPIRED: { name: 'Session Expired', description: 'FAIL_APIEXPIREDSESSION, tests auto-refresh' },
  TOKEN_SAVE_SUCCESS: { name: 'Token Save Success', description: 'Returns TokenId successfully' },
  TOKEN_NOT_FOUND: { name: 'Token Not Found', description: 'FAIL_TOKENNOTFOUND error' },
  WEBHOOK_VALID: { name: 'Valid Webhook', description: 'verifySessionToken returns SUCCESS' },
};

// Mock response data
const MOCK_SESSION_TOKEN = 'sandbox_session_token_mock_12345';
const MOCK_TICKET_ID = 999001;
const MOCK_TOKEN_ID = 'sandbox_token_mock_67890';

export class SandboxInterceptor {
  private activeScenario: string = 'PAYMENT_SUCCESS';

  setScenario(scenario: keyof typeof SANDBOX_SCENARIOS): void {
    this.activeScenario = scenario;
  }

  // Returns a mock fetch function for use in testing
  getMockFetch(): (input: string | URL, init?: RequestInit) => Promise<Response> {
    return async (input: string | URL, init?: RequestInit): Promise<Response> => {
      const url = input.toString();
      const body = init?.body ? JSON.parse(init.body as string) : {};

      if (url.includes('getSessionToken')) {
        return this.mockSessionToken();
      }
      if (url.includes('createTransactionPayment')) {
        return this.mockCreateTransaction();
      }
      if (url.includes('tokenCommand')) {
        return this.mockTokenCommand(body.Command);
      }
      if (url.includes('queryToken')) {
        return this.mockQueryToken();
      }
      if (url.includes('getTransactionInformation')) {
        return this.mockGetTransactionInfo();
      }
      if (url.includes('verifySessionToken')) {
        return this.mockVerifySessionToken();
      }
      if (url.includes('getPaymentSystem')) {
        return this.mockGetPaymentSystems();
      }
      if (url.includes('getCustomerId')) {
        return this.mockGetCustomerId();
      }

      return this.jsonResponse({ ReturnCode: 'SUCCESS' });
    };
  }

  private mockSessionToken(): Promise<Response> {
    if (this.activeScenario === 'SESSION_EXPIRED') {
      return this.jsonResponse({ ReturnCode: 'FAIL_APIEXPIREDSESSION' });
    }
    return this.jsonResponse({
      ReturnCode: 'SUCCESS',
      SessionToken: MOCK_SESSION_TOKEN,
      LifetimeSecs: 1800,
    });
  }

  private mockCreateTransaction(): Promise<Response> {
    switch (this.activeScenario) {
      case 'PAYMENT_INSUFFICIENT_FUNDS':
        return this.jsonResponse({
          ReturnCode: 'SUCCESS',
          TicketId: MOCK_TICKET_ID,
          TransactionResponse: { TranState: 'NOT_AUTHORIZED', ReturnCode: 'SUCCESS' },
        });
      case 'PAYMENT_INVALID_CARD':
        return this.jsonResponse({ ReturnCode: 'FAIL_INVALIDCREDITCARD' });
      case 'PAYMENT_BANK_PENDING':
        return this.jsonResponse({
          ReturnCode: 'SUCCESS',
          TicketId: MOCK_TICKET_ID,
          TransactionResponse: { TranState: 'BANK', ReturnCode: 'SUCCESS' },
        });
      case 'PAYMENT_DUPLICATE':
        return this.jsonResponse({ ReturnCode: 'FAIL_MERCHANTRANSID' });
      case 'PAYMENT_TIMEOUT':
        return this.jsonResponse({ ReturnCode: 'FAIL_SYSTEM' });
      default:
        return this.jsonResponse({
          ReturnCode: 'SUCCESS',
          TicketId: MOCK_TICKET_ID,
          TransactionResponse: { TranState: 'OK', ReturnCode: 'SUCCESS', TransValue: 100, PayCurrency: 'COP' },
        });
    }
  }

  private mockTokenCommand(command: string): Promise<Response> {
    if (this.activeScenario === 'TOKEN_NOT_FOUND' && command === 'REMOVE') {
      return this.jsonResponse({ ReturnCode: 'FAIL_TOKENNOTFOUND' });
    }
    if (this.activeScenario === 'TOKEN_SAVE_SUCCESS' || this.activeScenario === 'PAYMENT_SUCCESS') {
      return this.jsonResponse({
        ReturnCode: 'SUCCESS',
        TokenInfoArray: [
          { AttributeCode: 1, AttributeDesc: 'TokenId', AttributeValue: MOCK_TOKEN_ID },
          { AttributeCode: 11, AttributeDesc: 'Last4', AttributeValue: '1111' },
          { AttributeCode: 12, AttributeDesc: 'MaskedCard', AttributeValue: 'VISA ****1111' },
        ],
      });
    }
    return this.jsonResponse({ ReturnCode: 'SUCCESS', TokenInfoArray: [] });
  }

  private mockQueryToken(): Promise<Response> {
    return this.jsonResponse({
      ReturnCode: 'SUCCESS',
      TokenArray: [
        {
          TokenInfoArray: [
            { AttributeCode: 1, AttributeDesc: 'TokenId', AttributeValue: MOCK_TOKEN_ID },
            { AttributeCode: 11, AttributeDesc: 'Last4', AttributeValue: '1111' },
            { AttributeCode: 12, AttributeDesc: 'MaskedCard', AttributeValue: 'VISA ****1111' },
            { AttributeCode: 6, AttributeDesc: 'Usermail', AttributeValue: 'user@test.com' },
          ],
          TokenStatus: 'ACTIVE',
          LifetimeSecs: 86400,
        },
      ],
    });
  }

  private mockGetTransactionInfo(): Promise<Response> {
    const state = this.activeScenario === 'PAYMENT_BANK_PENDING' ? 'PENDING' : 'OK';
    return this.jsonResponse({
      ReturnCode: 'SUCCESS',
      TicketId: MOCK_TICKET_ID,
      TranState: state,
      TransValue: 100,
      PayCurrency: 'COP',
    });
  }

  private mockVerifySessionToken(): Promise<Response> {
    if (this.activeScenario === 'WEBHOOK_VALID') {
      return this.jsonResponse({ ReturnCode: 'SUCCESS' });
    }
    return this.jsonResponse({ ReturnCode: 'SUCCESS' });
  }

  private mockGetPaymentSystems(): Promise<Response> {
    return this.jsonResponse({
      ReturnCode: 'SUCCESS',
      PaymentSystemArray: [
        {
          PaymentSystem: '1',
          FiArray: [
            { FiCode: 'VISA', FiName: 'Visa' },
            { FiCode: 'MC', FiName: 'Mastercard' },
          ],
        },
        {
          PaymentSystem: '0',
          FiArray: [{ FiCode: 'PSE', FiName: 'PSE' }],
        },
      ],
    });
  }

  private mockGetCustomerId(): Promise<Response> {
    return this.jsonResponse({
      ReturnCode: 'SUCCESS',
      CustomerInfoArray: [
        { AttributeCode: 50, AttributeDesc: 'CustomerId', AttributeValue: 'cust_sandbox_001' },
      ],
    });
  }

  private jsonResponse(data: unknown): Promise<Response> {
    return Promise.resolve(
      new Response(JSON.stringify(data), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
  }
}

export const sandbox = new SandboxInterceptor();
