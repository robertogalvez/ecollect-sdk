import type { CardFormData } from './types.js';

/**
 * Fields that must NEVER appear in logs, analytics, or error reports.
 * Reference this list in any logging utility.
 */
export const NEVER_LOG_FIELDS: readonly string[] = [
  'cardNumber',
  'secureCode',
  'expirationDate',
  'cvv',
  'cvc',
  'cvc2',
  'cvv2',
];

/**
 * Warns developers if the form is running over an insecure connection.
 * Call once on component mount.
 */
export function warnIfInsecure(override = false): void {
  if (override) return;
  if (typeof window !== 'undefined' && window.location.protocol !== 'https:') {
    console.warn(
      '[ecollect] Payment form is running over HTTP. ' +
      'Card data collection requires HTTPS in production. ' +
      'Set config.insecureContextOverride=true to suppress this warning in local dev.',
    );
  }
}

/**
 * Overwrites sensitive card data fields before releasing references.
 * JavaScript GC does not guarantee immediate memory clearing, so we
 * overwrite with zeros first, then assign empty string.
 */
export function clearSensitiveData(data: Partial<CardFormData>): void {
  const sensitiveFields: (keyof CardFormData)[] = ['cardNumber', 'secureCode', 'expirationDate'];
  for (const field of sensitiveFields) {
    const current = data[field];
    if (typeof current === 'string' && current.length > 0) {
      // Overwrite in place before nulling (best-effort in JS runtime)
      (data as Record<string, string>)[field] = '0'.repeat(current.length);
    }
    (data as Record<string, string>)[field] = '';
  }
}

/**
 * Creates a safe loggable version of card form data with sensitive fields redacted.
 */
export function redactForLogging(data: Partial<CardFormData>): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(data)) {
    if (NEVER_LOG_FIELDS.includes(key)) {
      result[key] = '***';
    } else {
      result[key] = String(value ?? '');
    }
  }
  return result;
}
