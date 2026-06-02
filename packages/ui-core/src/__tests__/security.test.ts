import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { clearSensitiveData, NEVER_LOG_FIELDS, warnIfInsecure } from '../security.js';
import type { CardFormData } from '../types.js';

describe('clearSensitiveData', () => {
  it('overwrites fields with zeros before setting to empty string', () => {
    const data: Partial<CardFormData> = {
      cardNumber: '4111111111111111',
      secureCode: '123',
      expirationDate: '12/2026',
    };

    const assignments: string[] = [];
    const proxy = new Proxy(data as Record<string, string>, {
      set(target, prop, value) {
        if (typeof prop === 'string') {
          assignments.push(`${prop}=${value}`);
        }
        target[prop as string] = value;
        return true;
      },
    });

    clearSensitiveData(proxy as Partial<CardFormData>);

    // For cardNumber (length 16), should have seen zeros first, then ''
    const cardAssignments = assignments.filter((a) => a.startsWith('cardNumber='));
    expect(cardAssignments.length).toBeGreaterThanOrEqual(2);
    expect(cardAssignments[0]).toBe('cardNumber=' + '0'.repeat(16));
    expect(cardAssignments[1]).toBe('cardNumber=');
  });

  it('handles already-empty string without error', () => {
    const data: Partial<CardFormData> = {
      cardNumber: '',
      secureCode: '',
      expirationDate: '',
    };
    expect(() => clearSensitiveData(data)).not.toThrow();
  });

  it('handles missing fields without error', () => {
    const data: Partial<CardFormData> = {};
    expect(() => clearSensitiveData(data)).not.toThrow();
  });

  it('sets all sensitive fields to empty string after call', () => {
    const data: Partial<CardFormData> = {
      cardNumber: '4111111111111111',
      secureCode: '123',
      expirationDate: '12/2026',
    };
    clearSensitiveData(data);
    expect(data.cardNumber).toBe('');
    expect(data.secureCode).toBe('');
    expect(data.expirationDate).toBe('');
  });
});

describe('NEVER_LOG_FIELDS', () => {
  it('includes cardNumber', () => {
    expect(NEVER_LOG_FIELDS).toContain('cardNumber');
  });

  it('includes secureCode', () => {
    expect(NEVER_LOG_FIELDS).toContain('secureCode');
  });

  it('includes cvv', () => {
    expect(NEVER_LOG_FIELDS).toContain('cvv');
  });

  it('includes cvc', () => {
    expect(NEVER_LOG_FIELDS).toContain('cvc');
  });

  it('includes cvc2', () => {
    expect(NEVER_LOG_FIELDS).toContain('cvc2');
  });

  it('includes cvv2', () => {
    expect(NEVER_LOG_FIELDS).toContain('cvv2');
  });
});

describe('warnIfInsecure', () => {
  let originalWindow: typeof globalThis.window;
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    originalWindow = globalThis.window;
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    globalThis.window = originalWindow;
    warnSpy.mockRestore();
  });

  it('calls console.warn when protocol is http:', () => {
    globalThis.window = {
      location: { protocol: 'http:' },
    } as unknown as Window & typeof globalThis;

    warnIfInsecure();

    expect(warnSpy).toHaveBeenCalledOnce();
    expect(warnSpy.mock.calls[0][0]).toContain('[ecollect]');
  });

  it('is silent when protocol is https:', () => {
    globalThis.window = {
      location: { protocol: 'https:' },
    } as unknown as Window & typeof globalThis;

    warnIfInsecure();

    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('is silent when override=true, even on http:', () => {
    globalThis.window = {
      location: { protocol: 'http:' },
    } as unknown as Window & typeof globalThis;

    warnIfInsecure(true);

    expect(warnSpy).not.toHaveBeenCalled();
  });
});
