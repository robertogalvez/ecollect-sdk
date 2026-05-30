/**
 * HMAC-SHA256 signature helpers.
 * Works in both Node.js (18+) and modern browsers.
 */

/**
 * Compute HMAC-SHA256 of `message` using `secret`.
 * Returns a hex-encoded string.
 */
export async function hmacSha256(message: string, secret: string): Promise<string> {
  const enc = new TextEncoder();

  // Node 18+ / browser WebCrypto
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );

  const signature = await crypto.subtle.sign('HMAC', key, enc.encode(message));
  return bufferToHex(signature);
}

function bufferToHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Constant-time comparison to prevent timing attacks.
 */
export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}
