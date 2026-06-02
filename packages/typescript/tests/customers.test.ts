import { CustomersModule } from '../src/modules/customers';
import { SessionModule } from '../src/modules/session';
import { HttpClient } from '../src/utils/http';
import { CustomerNotFoundException } from '../src/errors/index';
import type { EcollectConfig } from '../src/config';
import type { CustomerInfo } from '../src/types/index';

jest.mock('../src/utils/http');
jest.mock('../src/modules/session');

const mockConfig: EcollectConfig = {
  apiKey: 'test-api-key',
  etyCode: 12345,
  environment: 'test',
};

const customerInfo: CustomerInfo = {
  email: 'juan@example.com',
  fullName: 'Juan Pérez',
  documentType: 'CC',
  documentNumber: '12345678',
  mobileCountryCode: '57',
  mobileNumber: '3001234567',
};

function makeCustomersModule(postFn: jest.Mock) {
  const httpInst = new (HttpClient as unknown as new (o: unknown) => { post: jest.Mock })({});
  httpInst.post = postFn;

  const sessionInst = new (SessionModule as unknown as new (c: unknown, h: unknown) => {
    getActive: jest.Mock;
    invalidate: jest.Mock;
  })(mockConfig, httpInst);
  sessionInst.getActive = jest.fn().mockResolvedValue('tok_session');
  sessionInst.invalidate = jest.fn();

  return new CustomersModule(
    mockConfig,
    httpInst as unknown as HttpClient,
    sessionInst as unknown as SessionModule,
  );
}

describe('CustomersModule', () => {
  describe('getOrCreateCustomerId()', () => {
    it('new customer returns CustomerId', async () => {
      const postMock = jest.fn().mockResolvedValue({
        ReturnCode: 'SUCCESS',
        CustomerInfoArray: [
          { AttributeCode: 100, AttributeDesc: 'CustomerId', AttributeValue: 'cust_new_001' },
        ],
      });
      const customers = makeCustomersModule(postMock);

      const result = await customers.getOrCreateCustomerId(customerInfo);
      expect(result.customerId).toBe('cust_new_001');
      expect(result.email).toBe(customerInfo.email);
      expect(result.fullName).toBe(customerInfo.fullName);
    });

    it('existing customer returns same CustomerId', async () => {
      const postMock = jest.fn().mockResolvedValue({
        ReturnCode: 'SUCCESS',
        CustomerInfoArray: [
          { AttributeCode: 100, AttributeDesc: 'CustomerId', AttributeValue: 'cust_existing_999' },
        ],
      });
      const customers = makeCustomersModule(postMock);

      const first = await customers.getOrCreateCustomerId(customerInfo);
      const second = await customers.getOrCreateCustomerId(customerInfo);

      expect(first.customerId).toBe('cust_existing_999');
      expect(second.customerId).toBe('cust_existing_999');
    });
  });

  describe('updateCustomerInfo()', () => {
    it('updates customer info successfully', async () => {
      const postMock = jest.fn().mockResolvedValue({
        ReturnCode: 'SUCCESS',
        CustomerInfoArray: [
          { AttributeCode: 100, AttributeDesc: 'CustomerId', AttributeValue: 'cust_upd_001' },
        ],
      });
      const customers = makeCustomersModule(postMock);

      const result = await customers.updateCustomerInfo('cust_upd_001', { email: 'new@example.com' });
      expect(result.customerId).toBe('cust_upd_001');
    });

    it('throws CustomerNotFoundException on FAIL_CUSTOMERNOTFOUND', async () => {
      const postMock = jest.fn().mockResolvedValue({
        ReturnCode: 'FAIL_CUSTOMERNOTFOUND',
      });
      const customers = makeCustomersModule(postMock);

      await expect(
        customers.updateCustomerInfo('bad_id', { email: 'new@example.com' }),
      ).rejects.toThrow(CustomerNotFoundException);
    });
  });
});
