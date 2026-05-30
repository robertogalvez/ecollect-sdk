/**
 * Client-side validation utilities.
 */

import { ValidationException, InvalidCardException } from '../errors/index.js';
import type { PaymentIntent } from '../types/index.js';

const SUPPORTED_CURRENCIES = ['COP', 'MXN', 'DOP', 'USD', 'EUR'];

const COUNTRY_RULES: Record<
  string,
  {
    documentTypes: string[];
    paymentSystems: number[];
    requiresUserTypeForPSE?: boolean;
    speiRequiresNoCard?: boolean;
    preAuthOnlyFiCode?: string;
  }
> = {
  CO: {
    documentTypes: ['CC', 'NIT', 'PP', 'CE', 'DE'],
    paymentSystems: [0, 1],
    requiresUserTypeForPSE: true,
  },
  DO: {
    documentTypes: ['CI', 'RNC', 'PP'],
    paymentSystems: [3, 6],
    preAuthOnlyFiCode: 'AZUL',
  },
  MX: {
    documentTypes: ['CURP', 'IFE', 'RFC', 'PP'],
    paymentSystems: [1, 7],
    speiRequiresNoCard: true,
  },
};

/**
 * Standard Luhn algorithm to validate card numbers.
 */
export function luhnCheck(cardNumber: string): boolean {
  const digits = cardNumber.replace(/\D/g, '');
  if (digits.length < 13 || digits.length > 19) return false;

  let sum = 0;
  let shouldDouble = false;

  for (let i = digits.length - 1; i >= 0; i--) {
    let digit = parseInt(digits[i], 10);
    if (shouldDouble) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
    shouldDouble = !shouldDouble;
  }

  return sum % 10 === 0;
}

/**
 * Validate email format.
 */
export function validateEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/**
 * Validate a PaymentIntent before sending to the API.
 */
export function validatePaymentIntent(intent: PaymentIntent, configEtyCode?: number): void {
  if (!intent.amount || intent.amount <= 0) {
    throw new ValidationException('amount must be greater than 0');
  }

  if (!/^\d+(\.\d{1,2})?$/.test(String(intent.amount)) && intent.amount <= 0) {
    throw new ValidationException('amount must be a positive number with at most 2 decimal places');
  }

  if (!intent.currency || !SUPPORTED_CURRENCIES.includes(intent.currency.toUpperCase())) {
    throw new ValidationException(
      `currency "${intent.currency}" is not supported. Supported: ${SUPPORTED_CURRENCIES.join(', ')}`,
    );
  }

  if (!intent.customer) {
    throw new ValidationException('customer is required');
  }

  if (!intent.customer.email || !validateEmail(intent.customer.email)) {
    throw new ValidationException('customer.email is invalid');
  }

  if (!intent.customer.fullName || intent.customer.fullName.trim().length === 0) {
    throw new ValidationException('customer.fullName is required');
  }

  // etyCode must come from either intent or config
  if (configEtyCode === undefined || configEtyCode === null) {
    throw new ValidationException('etyCode is required (set in EcollectClient config)');
  }
}

/**
 * Validate country-specific rules.
 * @param intent - The payment intent
 * @param country - ISO 3166-1 alpha-2, e.g. "CO", "MX", "DO"
 */
export function validateByCountry(intent: PaymentIntent, country: string): void {
  const rules = COUNTRY_RULES[country.toUpperCase()];
  if (!rules) {
    // Unknown country: no specific validations
    return;
  }

  if (
    intent.customer.documentType &&
    !rules.documentTypes.includes(intent.customer.documentType.toUpperCase())
  ) {
    throw new ValidationException(
      `documentType "${intent.customer.documentType}" is not valid for country ${country}. ` +
        `Allowed: ${rules.documentTypes.join(', ')}`,
    );
  }

  const psSystem = intent.paymentSystem ? parseInt(intent.paymentSystem, 10) : undefined;

  if (psSystem !== undefined && !isNaN(psSystem) && !rules.paymentSystems.includes(psSystem)) {
    throw new ValidationException(
      `paymentSystem ${psSystem} is not available in country ${country}. ` +
        `Allowed: ${rules.paymentSystems.join(', ')}`,
    );
  }

  // PSE (paymentSystem=0) requires UserType in Colombia
  if (psSystem === 0 && rules.requiresUserTypeForPSE) {
    if (intent.userType === undefined || intent.userType === null || intent.userType === '') {
      throw new ValidationException(
        'userType is required for PSE payments in Colombia (0=Natural, 1=Juridica)',
      );
    }
  }

  // SPEI (paymentSystem=7) in Mexico cannot have card data
  if (psSystem === 7 && rules.speiRequiresNoCard && intent.tokenId) {
    throw new ValidationException('SPEI payments in Mexico do not support card/token data');
  }
}

/**
 * Validate card data before tokenisation.
 */
export function validateCardNumber(cardNumber: string): void {
  const digits = cardNumber.replace(/\D/g, '');
  if (!luhnCheck(digits)) {
    throw new InvalidCardException(`Card number failed Luhn check`);
  }
}

/**
 * Validate expiration date format MM/YYYY and that it's not in the past.
 */
export function validateExpirationDate(expiry: string): void {
  const match = expiry.match(/^(\d{2})\/(\d{4})$/);
  if (!match) {
    throw new InvalidCardException('expirationDate must be in MM/YYYY format');
  }
  const month = parseInt(match[1], 10);
  const year = parseInt(match[2], 10);
  if (month < 1 || month > 12) {
    throw new InvalidCardException('expirationDate month is out of range');
  }
  const now = new Date();
  const expDate = new Date(year, month - 1, 1);
  const firstOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  if (expDate < firstOfThisMonth) {
    throw new InvalidCardException('Card has expired');
  }
}
