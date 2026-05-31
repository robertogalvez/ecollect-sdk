import type { CardBrand } from './types.js';

export interface BrandInfo {
  brand: CardBrand;
  paymentSystem: string;
  cvvLength: 3 | 4;
  minLength: number;
  maxLength: number;
  /** Spacing groups for number formatting, e.g. [4,4,4,4] or [4,6,5] */
  spacing: number[];
  color: string;
}

// All regexes operate on the first 6 sanitized digits — prevents ReDoS
const BRAND_PATTERNS: Array<{ pattern: RegExp; info: BrandInfo }> = [
  {
    pattern: /^3[47]/,
    info: { brand: 'Amex', paymentSystem: '3', cvvLength: 4, minLength: 15, maxLength: 15, spacing: [4, 6, 5], color: '#007bc1' },
  },
  {
    pattern: /^3(?:0[0-5]|[68])/,
    info: { brand: 'Diners', paymentSystem: '', cvvLength: 3, minLength: 14, maxLength: 14, spacing: [4, 6, 4], color: '#004a97' },
  },
  {
    pattern: /^35/,
    info: { brand: 'JCB', paymentSystem: '', cvvLength: 3, minLength: 16, maxLength: 19, spacing: [4, 4, 4, 4], color: '#003087' },
  },
  {
    pattern: /^6011|^65/,
    info: { brand: 'Discover', paymentSystem: '6', cvvLength: 3, minLength: 16, maxLength: 19, spacing: [4, 4, 4, 4], color: '#ff6600' },
  },
  {
    pattern: /^(?:50|6[304])/,
    info: { brand: 'Maestro', paymentSystem: '1', cvvLength: 3, minLength: 12, maxLength: 19, spacing: [4, 4, 4, 4], color: '#1a1f71' },
  },
  {
    pattern: /^5[1-5]|^2[2-7]/,
    info: { brand: 'Mastercard', paymentSystem: '2', cvvLength: 3, minLength: 16, maxLength: 16, spacing: [4, 4, 4, 4], color: '#eb001b' },
  },
  {
    pattern: /^4/,
    info: { brand: 'Visa', paymentSystem: '1', cvvLength: 3, minLength: 13, maxLength: 19, spacing: [4, 4, 4, 4], color: '#1a1f71' },
  },
];

const UNKNOWN: BrandInfo = {
  brand: 'Unknown',
  paymentSystem: '',
  cvvLength: 3,
  minLength: 13,
  maxLength: 19,
  spacing: [4, 4, 4, 4],
  color: '#64748b',
};

export function detectBrand(cardNumber: string): BrandInfo {
  const prefix = cardNumber.replace(/\D/g, '').slice(0, 6);
  if (!prefix) return UNKNOWN;
  for (const { pattern, info } of BRAND_PATTERNS) {
    if (pattern.test(prefix)) return info;
  }
  return UNKNOWN;
}

export function getPaymentSystem(brand: CardBrand): string {
  const found = BRAND_PATTERNS.find((p) => p.info.brand === brand);
  return found?.info.paymentSystem ?? '';
}

export function getBrandInfo(brand: CardBrand): BrandInfo {
  const found = BRAND_PATTERNS.find((p) => p.info.brand === brand);
  return found?.info ?? UNKNOWN;
}
