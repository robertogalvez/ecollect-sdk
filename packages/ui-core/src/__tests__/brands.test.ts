import { describe, it, expect } from 'vitest';
import { detectBrand } from '../brands.js';

describe('detectBrand', () => {
  it('returns Unknown for empty string', () => {
    const info = detectBrand('');
    expect(info.brand).toBe('Unknown');
  });

  it('detects Visa for prefix "4"', () => {
    const info = detectBrand('4');
    expect(info.brand).toBe('Visa');
    expect(info.paymentSystem).toBe('1');
    expect(info.cvvLength).toBe(3);
  });

  it('detects Mastercard for prefix "51"', () => {
    const info = detectBrand('51');
    expect(info.brand).toBe('Mastercard');
    expect(info.paymentSystem).toBe('2');
  });

  it('detects Amex for prefix "34"', () => {
    const info = detectBrand('34');
    expect(info.brand).toBe('Amex');
    expect(info.paymentSystem).toBe('3');
    expect(info.cvvLength).toBe(4);
  });

  it('detects Discover for prefix "6011"', () => {
    const info = detectBrand('6011');
    expect(info.brand).toBe('Discover');
  });

  it('detects Maestro for prefix "50" (minLength 12, maxLength 19)', () => {
    const info = detectBrand('50');
    expect(info.brand).toBe('Maestro');
    expect(info.minLength).toBe(12);
    expect(info.maxLength).toBe(19);
  });

  it('detects JCB for prefix "35"', () => {
    const info = detectBrand('35');
    expect(info.brand).toBe('JCB');
  });

  it('only uses first 6 digits — a 20-digit string starting with "4" is still Visa', () => {
    const info = detectBrand('41111111111111111111');
    expect(info.brand).toBe('Visa');
  });

  it('detects Mastercard for 2-series prefix "22"', () => {
    const info = detectBrand('22');
    expect(info.brand).toBe('Mastercard');
  });

  it('returns Unknown for unrecognized prefix', () => {
    const info = detectBrand('99999');
    expect(info.brand).toBe('Unknown');
  });
});
