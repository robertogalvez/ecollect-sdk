import { describe, it, expect } from 'vitest';
import { getMessages, interpolate } from '../i18n.js';

describe('getMessages', () => {
  it('returns Spanish messages for "es"', () => {
    const msgs = getMessages('es');
    expect(msgs.cardNumber.required).toContain('Ingresa');
  });

  it('returns English messages for "en"', () => {
    const msgs = getMessages('en');
    expect(msgs.cardNumber.required).toBe('Please enter your card number');
  });

  it('merges partial overrides correctly — only overridden keys change', () => {
    const msgs = getMessages('en', {
      cardNumber: { required: 'Custom required message' },
    });
    expect(msgs.cardNumber.required).toBe('Custom required message');
    // Other keys from cardNumber should be unchanged
    expect(msgs.cardNumber.luhn).toBe('Card number is not valid');
    // Other top-level keys should be unchanged
    expect(msgs.expiry.required).toBe('Please enter expiry date');
  });

  it('defaults to "es" when no language specified', () => {
    const msgs = getMessages();
    expect(msgs.cardNumber.required).toContain('Ingresa');
  });
});

describe('deepMerge prototype pollution protection', () => {
  it('does not pollute Object.prototype via __proto__ key', () => {
    // Attempt to merge with __proto__ key
    const malicious = JSON.parse('{"__proto__": {"polluted": true}}');
    // getMessages uses deepMerge internally
    getMessages('en', malicious);
    expect((Object.prototype as Record<string, unknown>)['polluted']).toBeUndefined();
  });

  it('does not pollute via constructor key', () => {
    const malicious = { constructor: { prototype: { polluted2: true } } } as unknown as Parameters<typeof getMessages>[1];
    getMessages('en', malicious);
    expect((Object.prototype as Record<string, unknown>)['polluted2']).toBeUndefined();
  });
});

describe('interpolate', () => {
  it('replaces {brand} placeholder', () => {
    expect(interpolate('{brand} detectada', { brand: 'Visa' })).toBe('Visa detectada');
  });

  it('keeps placeholder if key is missing', () => {
    expect(interpolate('{brand} detected', {})).toBe('{brand} detected');
  });

  it('replaces multiple placeholders', () => {
    expect(interpolate('{a} and {b}', { a: 'foo', b: 'bar' })).toBe('foo and bar');
  });

  it('handles template with no placeholders', () => {
    expect(interpolate('no placeholders', { brand: 'Visa' })).toBe('no placeholders');
  });
});
