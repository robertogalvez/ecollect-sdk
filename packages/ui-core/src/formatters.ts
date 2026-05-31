import { detectBrand } from './brands.js';

/** Strips all non-digit characters. */
export function sanitizeNumber(raw: string): string {
  return raw.replace(/\D/g, '');
}

/**
 * Formats a card number string with spaces according to the brand's spacing pattern.
 * Input is raw digits; output is the formatted display string.
 */
export function formatCardNumber(raw: string, spacing: number[] = [4, 4, 4, 4]): string {
  const digits = sanitizeNumber(raw);
  const maxLen = spacing.reduce((a, b) => a + b, 0);
  const capped = digits.slice(0, maxLen);

  const groups: string[] = [];
  let pos = 0;
  for (const size of spacing) {
    if (pos >= capped.length) break;
    groups.push(capped.slice(pos, pos + size));
    pos += size;
  }
  return groups.join(' ');
}

/**
 * Auto-detects the brand and formats accordingly.
 * Used for real-time input formatting.
 */
export function formatCardNumberAuto(raw: string): string {
  const digits = sanitizeNumber(raw);
  const brand = detectBrand(digits);
  return formatCardNumber(digits, brand.spacing);
}

/**
 * Formats expiry input to MM / YY display.
 * Baymard: use MM/YY (2-digit year), matches physical card.
 */
export function formatExpiry(raw: string): string {
  const digits = sanitizeNumber(raw).slice(0, 4);
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)} / ${digits.slice(2)}`;
}

/**
 * Converts MM/YY display format to MM/YYYY for the ecollect API.
 * "05/26" → "05/2026"
 */
export function expiryToApiFormat(mmyy: string): string {
  const digits = sanitizeNumber(mmyy);
  if (digits.length < 4) return mmyy;
  const mm = digits.slice(0, 2);
  const yy = digits.slice(2, 4);
  const fullYear = `20${yy}`;
  return `${mm}/${fullYear}`;
}

/**
 * Handles Backspace on a formatted card number field.
 * If the cursor is right after a space, it jumps over the space and deletes
 * the preceding digit — matches Stripe's behavior.
 *
 * Returns the new raw value (digits only) and the corrected cursor position.
 */
export function handleCardNumberBackspace(
  formatted: string,
  cursorPos: number,
): { value: string; cursorPos: number } {
  if (cursorPos === 0) return { value: formatted, cursorPos: 0 };

  const charBefore = formatted[cursorPos - 1];
  let deleteAt = cursorPos - 1;

  // If the character before cursor is a space, skip it and delete the digit before
  if (charBefore === ' ' && cursorPos >= 2) {
    deleteAt = cursorPos - 2;
  }

  const newFormatted = formatted.slice(0, deleteAt) + formatted.slice(deleteAt + 1);
  const newRaw = sanitizeNumber(newFormatted);
  const brand = detectBrand(newRaw);
  const reformatted = formatCardNumber(newRaw, brand.spacing);

  // Recalculate cursor: count non-space chars up to deleteAt in original
  const digitsBeforeDelete = sanitizeNumber(formatted.slice(0, deleteAt));
  let newCursor = 0;
  let digitCount = 0;
  for (let i = 0; i < reformatted.length; i++) {
    if (reformatted[i] !== ' ') {
      if (digitCount === digitsBeforeDelete.length) break;
      digitCount++;
    }
    newCursor = i + 1;
  }

  return { value: newRaw, cursorPos: newCursor };
}

/**
 * Attempts to parse a multi-field paste (e.g. from a password manager).
 * Input like "4111111111111111 05/26 123 John Doe" distributes to fields.
 */
export function parseMultiFieldPaste(text: string): Partial<{
  cardNumber: string;
  expiry: string;
  cvv: string;
  cardHolderName: string;
}> {
  const result: Partial<{ cardNumber: string; expiry: string; cvv: string; cardHolderName: string }> = {};

  // Extract expiry (MM/YY or MM-YY or MMYY)
  const expiryMatch = text.match(/\b(\d{2})[\/\-](\d{2,4})\b/);
  if (expiryMatch) {
    const mm = expiryMatch[1];
    const yy = expiryMatch[2].slice(-2);
    result.expiry = `${mm} / ${yy}`;
    text = text.replace(expiryMatch[0], '').trim();
  }

  // Cap input to prevent ReDoS on pathological paste strings
  text = text.slice(0, 200);

  // Extract card number (13-19 consecutive digits, possibly spaced)
  const cardMatch = text.match(/\b(\d[\d ]{10,20}\d)\b/);
  if (cardMatch) {
    result.cardNumber = sanitizeNumber(cardMatch[1]);
    text = text.replace(cardMatch[0], '').trim();
  }

  // Extract CVV (3-4 digits standalone)
  const cvvMatch = text.match(/\b(\d{3,4})\b/);
  if (cvvMatch) {
    result.cvv = cvvMatch[1];
    text = text.replace(cvvMatch[0], '').trim();
  }

  // Whatever remains could be the name
  const name = text.replace(/\s+/g, ' ').trim();
  if (name.length >= 2) {
    result.cardHolderName = name;
  }

  return result;
}
