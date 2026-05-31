import type { CardBrand, CardFormErrors } from './types.js';
import { detectBrand } from './brands.js';
import { sanitizeNumber } from './formatters.js';

/** Standard Luhn algorithm. Returns false for all-same-digit sequences. */
export function luhnCheck(cardNumber: string): boolean {
  const digits = cardNumber.replace(/\D/g, '');
  if (digits.length < 13 || digits.length > 19) return false;
  // Reject trivially invalid sequences (all same digit)
  if (/^(\d)\1+$/.test(digits)) return false;

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

/** Returns the expected CVV length for a given brand. */
export function getCvvLength(brand: CardBrand): 3 | 4 {
  return brand === 'Amex' ? 4 : 3;
}

/** Returns the valid card length range for a given brand. */
export function getCardLengthRange(brand: CardBrand): { min: number; max: number } {
  const ranges: Record<CardBrand, { min: number; max: number }> = {
    Visa:       { min: 13, max: 19 },
    Mastercard: { min: 16, max: 16 },
    Amex:       { min: 15, max: 15 },
    Discover:   { min: 16, max: 19 },
    Diners:     { min: 14, max: 14 },
    JCB:        { min: 16, max: 19 },
    Maestro:    { min: 12, max: 19 },
    Unknown:    { min: 13, max: 19 },
  };
  return ranges[brand];
}

/** Returns true if expiry is in the future (MM/YYYY or MM/YY accepted). */
export function isExpiryFuture(mm: number, yyyy: number): boolean {
  const now = new Date();
  const thisYear = now.getFullYear();
  const thisMonth = now.getMonth() + 1;
  if (yyyy > thisYear) return true;
  if (yyyy === thisYear && mm >= thisMonth) return true;
  return false;
}

/** Rejects expiry dates more than 10 years in the future. */
export function isExpiryTooFar(yyyy: number): boolean {
  return yyyy > new Date().getFullYear() + 10;
}

/** Validates email format. */
export function validateEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export interface FieldValidationMessages {
  cardNumber: { required: string; luhn: string; length: string; brandDisabled: string };
  expiry: { required: string; past: string; tooFar: string; invalid: string };
  cvv: { required: string; length: string };
  cardHolderName: { required: string; tooShort: string };
  email: { required: string; invalid: string };
  cardHolderId: { required: string };
}

/**
 * Validates a single field value. Returns error message string or null.
 * brand and enabledBrands are used for card-number-specific checks.
 */
export function validateField(
  field: keyof CardFormErrors,
  value: string,
  messages: FieldValidationMessages,
  brand: CardBrand = 'Unknown',
  enabledBrands?: CardBrand[],
): string | null {
  const trimmed = value.trim();

  switch (field) {
    case 'cardNumber': {
      if (!trimmed) return messages.cardNumber.required;
      const digits = sanitizeNumber(trimmed);
      const detectedBrand = detectBrand(digits);
      if (enabledBrands && enabledBrands.length > 0 && !enabledBrands.includes(detectedBrand.brand)) {
        return messages.cardNumber.brandDisabled;
      }
      const range = getCardLengthRange(detectedBrand.brand);
      if (digits.length < range.min || digits.length > range.max) return messages.cardNumber.length;
      if (!luhnCheck(digits)) return messages.cardNumber.luhn;
      return null;
    }

    case 'expiry': {
      if (!trimmed) return messages.expiry.required;
      const digits = sanitizeNumber(trimmed);
      if (digits.length < 4) return messages.expiry.invalid;
      const mm = parseInt(digits.slice(0, 2), 10);
      const yy = parseInt(digits.slice(2, 4), 10);
      const yyyy = 2000 + yy;
      if (mm < 1 || mm > 12) return messages.expiry.invalid;
      if (isExpiryTooFar(yyyy)) return messages.expiry.tooFar;
      if (!isExpiryFuture(mm, yyyy)) return messages.expiry.past;
      return null;
    }

    case 'cvv': {
      if (!trimmed) return messages.cvv.required;
      const digits = sanitizeNumber(trimmed);
      const expected = getCvvLength(brand);
      if (digits.length !== expected) return messages.cvv.length;
      return null;
    }

    case 'cardHolderName': {
      if (!trimmed) return messages.cardHolderName.required;
      const chars = [...trimmed];
      if (chars.length < 2) return messages.cardHolderName.tooShort;
      if (chars.length > 64) return messages.cardHolderName.tooShort;
      return null;
    }

    case 'email': {
      if (!trimmed) return messages.email.required;
      if (!validateEmail(trimmed)) return messages.email.invalid;
      return null;
    }

    case 'cardHolderId': {
      if (!trimmed) return messages.cardHolderId.required;
      return null;
    }

    default:
      return null;
  }
}
