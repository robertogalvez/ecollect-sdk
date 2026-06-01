import { PaymentSystemsModule } from '../src/modules/paymentSystems';
import { SessionModule } from '../src/modules/session';
import { HttpClient } from '../src/utils/http';
import type { EcollectConfig } from '../src/config';

jest.mock('../src/utils/http');
jest.mock('../src/modules/session');

const mockConfig: EcollectConfig = {
  apiKey: 'test-api-key',
  etyCode: 12345,
  environment: 'test',
};

function makePaymentSystemsModule(postFn: jest.Mock) {
  const httpInst = new (HttpClient as unknown as new (o: unknown) => { post: jest.Mock })({});
  httpInst.post = postFn;

  const sessionInst = new (SessionModule as unknown as new (c: unknown, h: unknown) => {
    getActive: jest.Mock;
    invalidate: jest.Mock;
  })(mockConfig, httpInst);
  sessionInst.getActive = jest.fn().mockResolvedValue('tok_session');
  sessionInst.invalidate = jest.fn();

  return new PaymentSystemsModule(
    mockConfig,
    httpInst as unknown as HttpClient,
    sessionInst as unknown as SessionModule,
  );
}

describe('PaymentSystemsModule', () => {
  describe('getPaymentSystems()', () => {
    it('returns array with PaymentSystem entries', async () => {
      const postMock = jest.fn().mockResolvedValue({
        ReturnCode: 'SUCCESS',
        PaymentSystemArray: [
          {
            PaymentSystem: '1',
            BrandImageUrl: 'https://cdn.example.com/visa.png',
            FiArray: [],
            FiImagesArray: [],
          },
          {
            PaymentSystem: '0',
            BrandImageUrl: 'https://cdn.example.com/pse.png',
            FiArray: [],
          },
        ],
      });
      const systems = makePaymentSystemsModule(postMock);

      const result = await systems.getPaymentSystems();
      expect(result).toHaveLength(2);
      expect(result[0]!.paymentSystem).toBe('1');
      expect(result[0]!.brandImageUrl).toBe('https://cdn.example.com/visa.png');
      expect(result[1]!.paymentSystem).toBe('0');
    });

    it('correctly parses FiArray with FiCode and FiName', async () => {
      const postMock = jest.fn().mockResolvedValue({
        ReturnCode: 'SUCCESS',
        PaymentSystemArray: [
          {
            PaymentSystem: '0',
            FiArray: [
              { FiCode: 'BCOLOMBIA', FiName: 'Bancolombia' },
              { FiCode: 'DAVIVIENDA', FiName: 'Davivienda' },
            ],
          },
        ],
      });
      const systems = makePaymentSystemsModule(postMock);

      const result = await systems.getPaymentSystems();
      expect(result).toHaveLength(1);
      const fi = result[0]!.financialInstitutions;
      expect(fi).toHaveLength(2);
      expect(fi![0]!.fiCode).toBe('BCOLOMBIA');
      expect(fi![0]!.fiName).toBe('Bancolombia');
      expect(fi![1]!.fiCode).toBe('DAVIVIENDA');
    });

    it('returns empty array when no systems configured (NO_RECORDS)', async () => {
      const postMock = jest.fn().mockResolvedValue({
        ReturnCode: 'NO_RECORDS',
      });
      const systems = makePaymentSystemsModule(postMock);

      const result = await systems.getPaymentSystems();
      expect(result).toHaveLength(0);
    });
  });
});
