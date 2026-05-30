import { TokensModule } from '../src/modules/tokens';
import { SessionModule } from '../src/modules/session';
import { HttpClient } from '../src/utils/http';
import {
  InvalidCardException,
  TokenNotFoundException,
} from '../src/errors/index';
import type { EcollectConfig } from '../src/config';
import type { CardData } from '../src/types/index';

jest.mock('../src/utils/http');
jest.mock('../src/modules/session');

const mockConfig: EcollectConfig = {
  apiKey: 'test-key',
  etyCode: 12345,
  environment: 'test',
};

const validCard: CardData = {
  cardNumber: '4111111111111111', // Luhn-valid Visa test number
  expirationDate: '12/2030',
  secureCode: '123',
  cardHolderName: 'Juan Perez',
  cardHolderIdType: 'CC',
  cardHolderId: '12345678',
  paymentSystem: '1',
  fiCode: 'VISA',
  email: 'juan@example.com',
  mobileCountryCode: '57',
  mobileNumber: '3001234567',
};

function makeTokensModule(postFn: jest.Mock) {
  const httpInst = new (HttpClient as unknown as new (o: unknown) => { post: jest.Mock })({});
  httpInst.post = postFn;

  const sessionInst = new (SessionModule as unknown as new (c: unknown, h: unknown) => {
    getActive: jest.Mock;
    invalidate: jest.Mock;
  })(mockConfig, httpInst);
  sessionInst.getActive = jest.fn().mockResolvedValue('tok_session');
  sessionInst.invalidate = jest.fn();

  return new TokensModule(
    mockConfig,
    httpInst as unknown as HttpClient,
    sessionInst as unknown as SessionModule,
  );
}

describe('TokensModule', () => {
  describe('save()', () => {
    it('saves a card and returns SavedCard', async () => {
      const postMock = jest.fn().mockResolvedValue({
        ReturnCode: 'SUCCESS',
        TokenInfoArray: [
          { AttributeCode: 1, AttributeDesc: 'TokenId', AttributeValue: 'tok_saved_001' },
          { AttributeCode: 12, AttributeDesc: 'MaskedCard', AttributeValue: 'VISA ****1111' },
          { AttributeCode: 11, AttributeDesc: 'Last4', AttributeValue: '1111' },
        ],
        LifetimeSecs: 3600,
      });
      const tokens = makeTokensModule(postMock);

      const result = await tokens.save(validCard);
      expect(result.tokenId).toBe('tok_saved_001');
      expect(result.maskedCard).toBe('VISA ****1111');
      expect(result.last4).toBe('1111');
    });

    it('sends SAVE command', async () => {
      const postMock = jest.fn().mockResolvedValue({
        ReturnCode: 'SUCCESS',
        TokenInfoArray: [{ AttributeCode: 1, AttributeDesc: 'TokenId', AttributeValue: 'tok_x' }],
      });
      const tokens = makeTokensModule(postMock);

      await tokens.save(validCard);
      const body = postMock.mock.calls[0][1] as { Command: string };
      expect(body.Command).toBe('SAVE');
    });

    it('rejects invalid card number (Luhn fail)', async () => {
      const tokens = makeTokensModule(jest.fn());
      const badCard = { ...validCard, cardNumber: '1234567890123456' };

      await expect(tokens.save(badCard)).rejects.toThrow(InvalidCardException);
    });

    it('rejects expired card', async () => {
      const tokens = makeTokensModule(jest.fn());
      const expiredCard = { ...validCard, expirationDate: '01/2020' };

      await expect(tokens.save(expiredCard)).rejects.toThrow(InvalidCardException);
    });
  });

  describe('get()', () => {
    it('sends GET command for temporary token', async () => {
      const postMock = jest.fn().mockResolvedValue({
        ReturnCode: 'SUCCESS',
        TokenInfoArray: [{ AttributeCode: 1, AttributeDesc: 'TokenId', AttributeValue: 'tok_temp' }],
        LifetimeSecs: 1800,
      });
      const tokens = makeTokensModule(postMock);

      const result = await tokens.get(validCard);
      const body = postMock.mock.calls[0][1] as { Command: string };
      expect(body.Command).toBe('GET');
      expect(result.tokenId).toBe('tok_temp');
    });
  });

  describe('hold()', () => {
    it('sends HOLD command', async () => {
      const postMock = jest.fn().mockResolvedValue({
        ReturnCode: 'SUCCESS',
        TokenInfoArray: [{ AttributeCode: 1, AttributeDesc: 'TokenId', AttributeValue: 'tok_hold' }],
      });
      const tokens = makeTokensModule(postMock);

      const result = await tokens.hold(validCard);
      const body = postMock.mock.calls[0][1] as { Command: string };
      expect(body.Command).toBe('HOLD');
      expect(result.tokenId).toBe('tok_hold');
    });
  });

  describe('list()', () => {
    it('returns saved cards', async () => {
      const postMock = jest.fn().mockResolvedValue({
        ReturnCode: 'SUCCESS',
        TokenArray: [
          {
            TokenInfoArray: [
              { AttributeCode: 1, AttributeDesc: 'TokenId', AttributeValue: 'tok_card1' },
              { AttributeCode: 12, AttributeDesc: 'MaskedCard', AttributeValue: 'VISA ****1111' },
            ],
            TokenStatus: 'ACTIVE',
            LifetimeSecs: 3600,
          },
        ],
      });
      const tokens = makeTokensModule(postMock);

      const cards = await tokens.list('user@example.com', '12345678');
      expect(cards).toHaveLength(1);
      expect(cards[0]!.tokenId).toBe('tok_card1');
      expect(cards[0]!.tokenStatus).toBe('ACTIVE');
    });

    it('returns empty array on NO_RECORDS', async () => {
      const postMock = jest.fn().mockResolvedValue({ ReturnCode: 'NO_RECORDS' });
      const tokens = makeTokensModule(postMock);

      const cards = await tokens.list('user@example.com', '12345678');
      expect(cards).toHaveLength(0);
    });
  });

  describe('delete()', () => {
    it('sends REMOVE command', async () => {
      const postMock = jest.fn().mockResolvedValue({
        ReturnCode: 'SUCCESS',
        TokenInfoArray: [],
      });
      const tokens = makeTokensModule(postMock);

      await tokens.delete('tok_to_delete', 'user@example.com', '12345678');
      const body = postMock.mock.calls[0][1] as { Command: string };
      expect(body.Command).toBe('REMOVE');
    });

    it('throws TokenNotFoundException on FAIL_TOKENNOTFOUND', async () => {
      const postMock = jest.fn().mockResolvedValue({ ReturnCode: 'FAIL_TOKENNOTFOUND' });
      const tokens = makeTokensModule(postMock);

      await expect(
        tokens.delete('bad_tok', 'user@example.com', '12345678'),
      ).rejects.toThrow(TokenNotFoundException);
    });
  });

  describe('update()', () => {
    it('sends UPDATE command with new expiry', async () => {
      const postMock = jest.fn().mockResolvedValue({
        ReturnCode: 'SUCCESS',
        TokenInfoArray: [
          { AttributeCode: 1, AttributeDesc: 'TokenId', AttributeValue: 'tok_updated' },
        ],
      });
      const tokens = makeTokensModule(postMock);

      await tokens.update('tok_to_update', '12/2035');
      const body = postMock.mock.calls[0][1] as { Command: string };
      expect(body.Command).toBe('UPDATE');
    });

    it('validates expiry format', async () => {
      const tokens = makeTokensModule(jest.fn());
      await expect(tokens.update('tok', 'bad-date')).rejects.toThrow(InvalidCardException);
    });
  });
});
