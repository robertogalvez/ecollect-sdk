import {
  luhnCheck,
  validateEmail,
  validatePaymentIntent,
  validateByCountry,
  validateCardNumber,
  validateExpirationDate,
} from '../src/utils/validators';
import { ValidationException, InvalidCardException } from '../src/errors/index';
import type { PaymentIntent } from '../src/types/index';

const baseIntent: PaymentIntent = {
  amount: 100,
  currency: 'COP',
  customer: {
    fullName: 'Juan Pérez',
    email: 'juan@example.com',
    documentType: 'CC',
    documentNumber: '12345678',
  },
};

describe('luhnCheck', () => {
  it('validates a correct Visa test number', () => {
    expect(luhnCheck('4111111111111111')).toBe(true);
  });

  it('validates a correct Mastercard test number', () => {
    expect(luhnCheck('5500005555555559')).toBe(true);
  });

  it('rejects an invalid card number', () => {
    expect(luhnCheck('1234567890123456')).toBe(false);
  });

  it('rejects a number with wrong check digit', () => {
    expect(luhnCheck('4111111111111112')).toBe(false);
  });

  it('rejects too-short numbers', () => {
    expect(luhnCheck('41111111')).toBe(false);
  });

  it('handles numbers with spaces', () => {
    // 4111 1111 1111 1111 - Luhn valid
    expect(luhnCheck('4111 1111 1111 1111')).toBe(true);
  });
});

describe('validateEmail', () => {
  it('validates a correct email', () => {
    expect(validateEmail('user@example.com')).toBe(true);
  });

  it('validates email with subdomain', () => {
    expect(validateEmail('user@mail.example.co')).toBe(true);
  });

  it('rejects email without @', () => {
    expect(validateEmail('notanemail')).toBe(false);
  });

  it('rejects email without domain', () => {
    expect(validateEmail('user@')).toBe(false);
  });

  it('rejects email with spaces', () => {
    expect(validateEmail('user @example.com')).toBe(false);
  });
});

describe('validatePaymentIntent', () => {
  it('passes for a valid intent', () => {
    expect(() => validatePaymentIntent(baseIntent, 12345)).not.toThrow();
  });

  it('throws for amount = 0', () => {
    expect(() => validatePaymentIntent({ ...baseIntent, amount: 0 }, 12345)).toThrow(ValidationException);
  });

  it('throws for negative amount', () => {
    expect(() => validatePaymentIntent({ ...baseIntent, amount: -10 }, 12345)).toThrow(ValidationException);
  });

  it('throws for unsupported currency', () => {
    expect(() =>
      validatePaymentIntent({ ...baseIntent, currency: 'XYZ' }, 12345),
    ).toThrow(ValidationException);
  });

  it('throws when customer is missing', () => {
    const intent = { ...baseIntent, customer: undefined as unknown as typeof baseIntent.customer };
    expect(() => validatePaymentIntent(intent, 12345)).toThrow(ValidationException);
  });

  it('throws for invalid email', () => {
    const intent = {
      ...baseIntent,
      customer: { ...baseIntent.customer, email: 'not-an-email' },
    };
    expect(() => validatePaymentIntent(intent, 12345)).toThrow(ValidationException);
  });

  it('throws when etyCode is missing', () => {
    expect(() => validatePaymentIntent(baseIntent, undefined)).toThrow(ValidationException);
  });

  it('accepts USD currency', () => {
    expect(() =>
      validatePaymentIntent({ ...baseIntent, currency: 'USD' }, 12345),
    ).not.toThrow();
  });
});

describe('validateByCountry', () => {
  it('passes valid CO intent', () => {
    expect(() =>
      validateByCountry(
        {
          ...baseIntent,
          customer: { ...baseIntent.customer, documentType: 'CC' },
          paymentSystem: '1',
        },
        'CO',
      ),
    ).not.toThrow();
  });

  it('throws for invalid document type in CO', () => {
    expect(() =>
      validateByCountry(
        {
          ...baseIntent,
          customer: { ...baseIntent.customer, documentType: 'CURP' },
          paymentSystem: '1',
        },
        'CO',
      ),
    ).toThrow(ValidationException);
  });

  it('throws for PSE without UserType in CO', () => {
    expect(() =>
      validateByCountry(
        {
          ...baseIntent,
          paymentSystem: '0',
          // userType missing
        },
        'CO',
      ),
    ).toThrow(ValidationException);
  });

  it('passes for PSE with UserType in CO', () => {
    expect(() =>
      validateByCountry(
        {
          ...baseIntent,
          paymentSystem: '0',
          userType: '0',
        },
        'CO',
      ),
    ).not.toThrow();
  });

  it('throws for SPEI with token in MX', () => {
    expect(() =>
      validateByCountry(
        {
          ...baseIntent,
          paymentSystem: '7',
          tokenId: 'tok_123',
          customer: { ...baseIntent.customer, documentType: 'RFC' },
        },
        'MX',
      ),
    ).toThrow(ValidationException);
  });

  it('passes for unknown country (no validation)', () => {
    expect(() =>
      validateByCountry({ ...baseIntent }, 'AR'),
    ).not.toThrow();
  });
});

describe('validateCardNumber', () => {
  it('passes for valid card', () => {
    expect(() => validateCardNumber('4111111111111111')).not.toThrow();
  });

  it('throws for invalid card', () => {
    expect(() => validateCardNumber('1234567890123456')).toThrow(InvalidCardException);
  });
});

describe('validateExpirationDate', () => {
  const nextYear = new Date().getFullYear() + 1;

  it('passes for future date', () => {
    expect(() => validateExpirationDate(`12/${nextYear}`)).not.toThrow();
  });

  it('throws for past date', () => {
    expect(() => validateExpirationDate('01/2020')).toThrow(InvalidCardException);
  });

  it('throws for invalid format', () => {
    expect(() => validateExpirationDate('2025-12')).toThrow(InvalidCardException);
  });

  it('throws for invalid month', () => {
    expect(() => validateExpirationDate(`13/${nextYear}`)).toThrow(InvalidCardException);
  });
});
