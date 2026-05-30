# Plan de Seguridad y Blindaje — SDK de ecollect

## Resumen de Hallazgos

| Categoría | Crítica | Alta | Media | Baja |
|---|---|---|---|---|
| Credenciales (ApiKey / SessionToken) | 1 | 2 | 0 | 0 |
| PCI-DSS / Escape de PAN | 2 | 1 | 1 | 0 |
| Validaciones de input | 0 | 0 | 4 | 1 |
| Manejo de errores | 1 | 1 | 3 | 0 |
| Seguridad de webhooks | 1 | 1 | 2 | 0 |
| SDKs móviles (Android / iOS) | 0 | 4 | 2 | 0 |
| PHP (WooCommerce / PrestaShop) | 0 | 3 | 2 | 0 |
| Simulador (Netlify + Neon) | 0 | 3 | 3 | 0 |
| Logging | 1 | 1 | 3 | 0 |
| Rate limiting | 0 | 0 | 4 | 0 |
| Dependencias de terceros | 0 | 0 | 2 | 0 |
| Versionado y actualizaciones | 0 | 0 | 1 | 3 |
| **TOTAL** | **6** | **16** | **27** | **4** |

---

## 1. Credenciales — ApiKey y SessionToken

### [CRÍTICA] SEC-01: SessionToken en memoria sin limpieza explícita

**Problema:** El SessionToken se mantiene en caché in-memory sin especificar limpieza después de cada uso. En SDKs móviles, un memory dump puede exponer tokens activos.

**Corrección en todos los SDKs:**
```typescript
// Después de cada operación que consume el token:
class SessionManager {
  private token: string | null = null;

  async getToken(): Promise<string> {
    if (!this.token || this.isExpired()) {
      this.token = await this.fetchNewToken();
    }
    return this.token;
  }

  // Para tokenCommand: siempre token nuevo y limpiarlo tras uso
  async getTokenAndInvalidate(): Promise<string> {
    const token = await this.fetchNewToken();
    // Token usado una sola vez — nunca se cachea
    return token;
  }

  clear(): void {
    // Overwrite en memoria antes de null
    if (this.token) {
      this.token = '\0'.repeat(this.token.length);
      this.token = null;
    }
  }
}
```
- **Kotlin:** `Arrays.fill(tokenByteArray, 0.toByte())` antes de liberar referencia.
- **Swift:** `token.withUnsafeMutableBytes { ptr in ptr.initializeMemory(as: UInt8.self, repeating: 0) }`
- **Aplica a:** Todos los SDKs.

### [ALTA] SEC-02: ApiKey sin rotación automatizada en entornos de despliegue

**Problema:** No hay política de rotación de ApiKey documentada para WooCommerce, PrestaShop ni el simulador.

**Corrección:**
- Documentar rotación manual cada 30 días en README de cada SDK.
- En Netlify (simulador): usar GitHub Secrets en lugar de Netlify UI env vars (auditables y revocables).
- En WooCommerce/PrestaShop: el plugin debe mostrar advertencia en el admin si la key tiene >30 días (comparar con fecha de activación guardada en DB del comercio).
- **Nunca** incluir ApiKey en logs, stack traces ni mensajes de error.

### [ALTA] SEC-03: Certificate Pinning ausente en SDKs móviles

**Problema:** Sin pinning, los SDKs Android e iOS son vulnerables a ataques MITM en redes comprometidas.

**Corrección en Kotlin (OkHttp):**
```kotlin
val certificatePinner = CertificatePinner.Builder()
    .add("*.e-collect.com", "sha256/AAAA...") // pin del cert público de ecollect
    .add("*.e-collect.com", "sha256/BBBB...") // pin de backup
    .build()

val okHttpClient = OkHttpClient.Builder()
    .certificatePinner(certificatePinner)
    .build()
```

**Corrección en Swift (URLSession):**
```swift
class EcollectSessionDelegate: NSObject, URLSessionDelegate {
    func urlSession(_ session: URLSession,
                    didReceive challenge: URLAuthenticationChallenge,
                    completionHandler: @escaping (URLSession.AuthChallengeDisposition, URLCredential?) -> Void) {
        guard let serverTrust = challenge.protectionSpace.serverTrust,
              let cert = SecTrustGetCertificateAtIndex(serverTrust, 0) else {
            completionHandler(.cancelAuthenticationChallenge, nil)
            return
        }
        let certData = SecCertificateCopyData(cert) as Data
        let certHash = SHA256.hash(data: certData).map { String(format: "%02x", $0) }.joined()
        let knownPins = ["aaaa...", "bbbb..."] // pins de ecollect
        if knownPins.contains(certHash) {
            completionHandler(.useCredential, URLCredential(trust: serverTrust))
        } else {
            completionHandler(.cancelAuthenticationChallenge, nil)
        }
    }
}
```
- Publicar los hashes SHA-256 de los certificados de ecollect en el repositorio (renovar al rotar certs).

---

## 2. PCI-DSS — Escape de PAN

### [CRÍTICA] SEC-04: PAN puede propagarse en mensajes de error o responses

**Problema:** Si ecollect retorna inesperadamente `CardNumber` en una respuesta, o si un error contiene el número de tarjeta, el SDK podría propagarlo al merchant sin filtrar.

**Corrección — PAN Sanitizer (implementar en TODOS los SDKs):**
```typescript
const PAN_REGEX = /\b\d{13,19}\b/g;
const CVV_REGEX = /\b\d{3,4}\b/g; // solo en contextos de tarjeta

function sanitize(value: string): string {
  return value.replace(PAN_REGEX, '[REDACTED-PAN]');
}

function sanitizeObject(obj: unknown): unknown {
  if (typeof obj === 'string') return sanitize(obj);
  if (Array.isArray(obj)) return obj.map(sanitizeObject);
  if (obj && typeof obj === 'object') {
    return Object.fromEntries(
      Object.entries(obj).map(([k, v]) => [k, sanitizeObject(v)])
    );
  }
  return obj;
}

// Aplicar en:
// 1. Antes de loguear cualquier request/response
// 2. Antes de incluir datos en mensajes de excepción
// 3. Al validar response de tokenCommand (rechazar si contiene AttributeCode 0)
function assertNoPanInResponse(response: unknown): void {
  const serialized = JSON.stringify(response);
  if (PAN_REGEX.test(serialized)) {
    logger.error('[SEC] PAN detectado en response — bloqueado');
    throw new SecurityError('Respuesta de API contiene datos sensibles inesperados');
  }
}
```

### [CRÍTICA] SEC-05: CardNumber debe ser limpiado de memoria inmediatamente tras envío

**Problema:** En `createToken()`, el `cardData.number` (PAN) se mantiene en memoria hasta que el GC lo libere.

**Corrección:**
```typescript
async function createToken(cardData: CardData): Promise<TokenResult> {
  const cardNumber = cardData.number; // referencia local
  try {
    const result = await callTokenCommand(cardNumber, ...);
    return result;
  } finally {
    // Overwrite referencia local — el objeto original es responsabilidad del merchant
    (cardData as any).number = '\0'.repeat(cardData.number?.length ?? 16);
  }
}
```
- En Kotlin/Swift: usar `SecureBytes` o `CharArray` con `fill(0)` en lugar de `String` para el PAN.

### [ALTA] SEC-06: Webhooks — validar que el payload no contiene PAN

**Problema:** La API doc de ecollect no especifica qué campos envía en el webhook. Si llegara a incluir datos de tarjeta, el simulador los persistiría en Neon sin filtrar.

**Corrección en el receptor de webhooks:**
```typescript
// netlify/functions/webhook.ts
export const handler = async (event) => {
  const payload = JSON.parse(event.body ?? '{}');

  // Rechazar si payload contiene PAN (AttributeCode 0 o CardNumber)
  const forbidden = ['CardNumber', 'SecureCode', 'ExpirationDate'];
  for (const field of forbidden) {
    if (JSON.stringify(payload).includes(field)) {
      logger.warn('[SEC] Webhook con campo sensible rechazado');
      return { statusCode: 400, body: 'Invalid webhook' };
    }
  }

  // Solo persistir campos seguros
  const safePayload = {
    ticketId: payload.TicketId,
    tranState: payload.TranState,
    sessionToken: payload.SessionToken,
    bankProcessDate: payload.BankProcessDate,
    trazabilityCode: payload.TrazabilityCode,
  };
  await db.insert(webhookEvents).values({ rawPayload: safePayload, ... });
};
```

---

## 3. Validaciones de Input

### [MEDIA] SEC-07: Validaciones de campos insuficientes

**Tabla de validaciones a implementar en todos los SDKs:**

| Campo | Regla de validación |
|---|---|
| `amount` | Decimal positivo, máx 10 dígitos enteros + 2 decimales. Mínimo configurable por SrvCode. |
| `currency` | Whitelist: `['COP', 'MXN', 'DOP', 'USD']`. Validar que coincide con SrvCurrency configurado. |
| `email` | RFC 5322 via librería (validator.js, email-validator). Normalizar a lowercase. Máx 254 chars. |
| `cardNumber` | Algoritmo de Luhn. Solo dígitos. 13–19 caracteres. |
| `cvv` | 3 dígitos (4 solo si FiCode = AMEX). Solo numérico. |
| `expirationDate` | Formato MM/YYYY. Fecha futura. |
| `installments` | Entero 1–36 (Colombia). Solo aplica en CO con PaymentSystem=1. |
| `documentNumber` | Por país y tipo: CC (CO): `/^\d{8,10}$/`, NIT: `/^\d{9}$/`, CI (DO): `/^\d{11}$/`, RFC (MX): `/^[A-Z]{4}\d{6}[A-Z0-9]{3}$/` |
| `mobileNumber` | Solo dígitos. 7–15 caracteres. |
| `merchantTransactionId` | Alfanumérico. Máx 100 chars. Único por transacción. |
| `invoice` | Alfanumérico. Máx 50 chars. Único si se especifica. |
| `invoiceDueDate` | Formato `yyyyMMddHHmmss`. Fecha futura. |
| `subservicesArray` | Suma de porcentajes == 100% (ValueType=1) o suma de valores == transValue (ValueType=0). |

### [MEDIA] SEC-08: CVV según franquicia

```typescript
function validateCvv(cvv: string, fiCode: string): void {
  const isAmex = fiCode?.toUpperCase() === 'AMEX';
  const expectedLength = isAmex ? 4 : 3;
  if (!/^\d+$/.test(cvv) || cvv.length !== expectedLength) {
    throw new ValidationError(`CVV debe tener ${expectedLength} dígitos para ${fiCode ?? 'esta tarjeta'}`);
  }
}
```

---

## 4. Manejo de Errores

### [CRÍTICA] SEC-09: AuthResponse y FailCode no deben exponerse al usuario final

**Corrección — ExceptionFilter en todos los SDKs:**
```typescript
class EcollectError extends Error {
  public readonly code: string;
  public readonly userMessage: string;
  // AuthResponse e internals NUNCA en propiedades públicas
  private readonly _internalDetail?: string;

  constructor(code: string, userMessage: string, internalDetail?: string) {
    super(userMessage); // mensaje público, sin datos internos
    this.code = code;
    this.userMessage = userMessage;
    this._internalDetail = internalDetail;
  }

  // Solo disponible en modo DEBUG — nunca en producción
  getDebugInfo(debugMode: boolean): string | undefined {
    return debugMode ? this._internalDetail : undefined;
  }
}
```

**Mapeo de FailCode a mensajes genéricos:**
```typescript
const failCodeMessages: Record<string, string> = {
  // No usar FailCode raw — siempre mensaje genérico
  default: 'La transacción no pudo completarse. Contacte a su banco o intente con otro método de pago.',
};
// FailCode se loguea internamente, nunca se retorna al merchant ni al usuario.
```

### [ALTA] SEC-10: Stack traces y errores no deben incluir payloads de tarjeta

**Corrección:**
```typescript
// En TODOS los catch blocks del SDK:
try {
  await callEcollect(payload);
} catch (error) {
  // Loguear solo lo seguro
  logger.error({
    event: 'ecollect_api_error',
    ticketId: payload.ticketId,
    errorCode: error.returnCode,
    // NO: payload completo, NO: TokenInfoArray, NO: CardNumber
  });
  throw new EcollectError(error.returnCode, getUserMessage(error.returnCode));
}
```

---

## 5. Seguridad de Webhooks

### [CRÍTICA] SEC-11: Esquema de firma de webhooks (HMAC-SHA256)

**Problema:** La API doc de ecollect no documenta firma de webhooks explícitamente. Se recomienda que ecollect implemente el siguiente esquema (confirmar con el equipo de ecollect):

**Esquema recomendado:**
- ecollect incluye header `X-Ecollect-Signature: sha256=<HMAC>`
- HMAC calculado sobre el raw request body usando la ApiKey del comercio como secret
- Timestamp en header `X-Ecollect-Timestamp` para protección anti-replay

**Implementación en SDK:**
```typescript
function verifyWebhookSignature(
  rawBody: string,
  signature: string,    // header X-Ecollect-Signature
  timestamp: string,    // header X-Ecollect-Timestamp
  apiKey: string
): void {
  // 1. Validar freshness (protección anti-replay)
  const ts = parseInt(timestamp, 10);
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - ts) > 300) { // 5 minutos de tolerancia
    throw new WebhookValidationError('Webhook timestamp fuera de ventana válida');
  }

  // 2. Calcular firma esperada
  const payload = `${timestamp}.${rawBody}`;
  const expected = crypto
    .createHmac('sha256', apiKey)
    .update(payload)
    .digest('hex');

  // 3. Comparación en tiempo constante (protección anti-timing attack)
  const sigBuffer = Buffer.from(signature.replace('sha256=', ''), 'hex');
  const expBuffer = Buffer.from(expected, 'hex');
  if (sigBuffer.length !== expBuffer.length ||
      !crypto.timingSafeEqual(sigBuffer, expBuffer)) {
    throw new WebhookValidationError('Firma de webhook inválida');
  }
}
```

**Nota:** Mientras ecollect no implemente firma HMAC, el mecanismo alternativo es verificar via `verifySessionToken` API (ya documentado). Ambos deben ser soportados.

### [ALTA] SEC-12: Idempotencia en webhooks para prevenir replay

**Corrección en receptor de webhooks:**
```typescript
// Antes de procesar, verificar que TicketId no fue procesado antes
const existing = await db.select().from(webhookEvents)
  .where(and(
    eq(webhookEvents.ticketId, payload.TicketId),
    eq(webhookEvents.tranState, 'PROCESSED')
  ));

if (existing.length > 0) {
  // Responder SUCCESS para que ecollect no reintente, pero no reprocesar
  return { statusCode: 200, body: JSON.stringify({ ReturnCode: 'SUCCESS' }) };
}
```

### [MEDIA] SEC-13: Rate limiting en endpoint de webhooks

```typescript
// netlify/functions/webhook.ts — rate limiting por IP
const RATE_LIMIT = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(ip: string): void {
  const now = Date.now();
  const entry = RATE_LIMIT.get(ip) ?? { count: 0, resetAt: now + 60_000 };

  if (now > entry.resetAt) {
    entry.count = 0;
    entry.resetAt = now + 60_000;
  }

  entry.count++;
  RATE_LIMIT.set(ip, entry);

  if (entry.count > 100) {
    throw new RateLimitError('Too many webhook requests');
  }
}
```

---

## 6. Seguridad en SDKs Móviles

### [ALTA] SEC-14: Almacenamiento seguro de SessionToken en móviles

**Android (Kotlin) — EncryptedSharedPreferences:**
```kotlin
val masterKey = MasterKey.Builder(context)
    .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
    .build()

val securePrefs = EncryptedSharedPreferences.create(
    context,
    "ecollect_session",
    masterKey,
    EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
    EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
)

// Guardar SessionToken
securePrefs.edit().putString("session_token", token).apply()

// Limpiar al expirar
securePrefs.edit().remove("session_token").apply()
```

**iOS (Swift) — Keychain:**
```swift
func storeSessionToken(_ token: String) throws {
    let data = Data(token.utf8)
    let query: [String: Any] = [
        kSecClass as String:            kSecClassGenericPassword,
        kSecAttrService as String:      "com.ecollect.sdk",
        kSecAttrAccount as String:      "session_token",
        kSecValueData as String:        data,
        kSecAttrAccessible as String:   kSecAttrAccessibleWhenUnlockedThisDeviceOnly
    ]
    SecItemDelete(query as CFDictionary)
    let status = SecItemAdd(query as CFDictionary, nil)
    guard status == errSecSuccess else { throw KeychainError.unhandledError(status) }
}
```
- `kSecAttrAccessibleWhenUnlockedThisDeviceOnly`: no sincroniza con iCloud, solo accesible con pantalla desbloqueada.

### [ALTA] SEC-15: Deep Links — usar App Links y Universal Links

**Problema:** Custom URL schemes (`myapp://payment`) son interceptables por otras apps.

**Corrección:**
- Android: Registrar el callback URL como **App Link** verificado (`https://merchant.com/.well-known/assetlinks.json`).
- iOS: Registrar como **Universal Link** (`https://merchant.com/.well-known/apple-app-site-association`).
- Documentar en README de SDKs móviles que `URLRedirect` debe ser una URL HTTPS del dominio del comercio, nunca un custom scheme.

### [MEDIA] SEC-16: ProGuard rules para Android

**consumer-rules.pro (incluir en AAR del SDK Kotlin):**
```
# Preservar clases públicas del SDK para que el merchant pueda usarlas
-keep class com.ecollect.sdk.** { public *; }
-keepnames class com.ecollect.sdk.**
# No loguear líneas de código en stack traces en prod
-renamesourcefileattribute SourceFile
-keepattributes SourceFile,LineNumberTable
```

---

## 7. Seguridad en PHP (WooCommerce / PrestaShop)

### [ALTA] SEC-17: CSRF Protection en plugins PHP

**WooCommerce — validar nonce en webhook y en checkout:**
```php
// En checkout form (checkout.php)
wp_nonce_field('ecollect_payment', 'ecollect_nonce');

// En webhook handler (class-ecollect-gateway.php)
public function process_webhook() {
    // Webhooks de ecollect no tienen nonce (son de servidor a servidor)
    // Verificar origen via firma HMAC o verifySessionToken en su lugar
    if (!$this->verify_webhook_signature($_POST)) {
        wp_die('Invalid webhook', 403);
    }
}

// En process_payment (form submission del usuario)
public function process_payment($order_id) {
    if (!wp_verify_nonce($_POST['ecollect_nonce'], 'ecollect_payment')) {
        wc_add_notice('Error de seguridad. Intente de nuevo.', 'error');
        return;
    }
    // ...
}
```

**PrestaShop — validar token:**
```php
// En módulo de pago
if (!Tools::isSubmit('token') || Tools::getValue('token') !== $this->token) {
    Tools::redirect('index.php?controller=order&step=3&reason=security');
}
```

### [ALTA] SEC-18: No usar `unserialize()` en webhooks PHP

**Corrección:**
```php
// INCORRECTO — vulnerable a Object Injection
$payload = unserialize($rawBody);

// CORRECTO — siempre JSON
$payload = json_decode($rawBody, true);
if (json_last_error() !== JSON_ERROR_NONE) {
    http_response_code(400);
    exit('Invalid JSON');
}
```

### [ALTA] SEC-19: Logs PHP fuera del web root

**Corrección en plugin WooCommerce:**
```php
// INCORRECTO — accesible en https://merchant.com/wp-content/uploads/ecollect-logs/
$logPath = WP_CONTENT_DIR . '/uploads/ecollect-logs/';

// CORRECTO — fuera de web root o protegido con .htaccess
$logPath = WP_CONTENT_DIR . '/ecollect-logs/';

// Agregar .htaccess automáticamente en activación del plugin
file_put_contents($logPath . '.htaccess', "Deny from all\n");
```

### [MEDIA] SEC-20: Escapar SavedCard data antes de renderizar en admin

```php
// INCORRECTO
echo $saved_card['masked_card'];

// CORRECTO
echo esc_html($saved_card['masked_card']);
echo esc_attr($saved_card['fi_name']);
```

---

## 8. Seguridad del Simulador (Netlify + Neon)

### [ALTA] SEC-21: CORS restrictivo en Netlify Functions

```typescript
// netlify/functions/_helpers/cors.ts
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN ?? 'https://your-app.netlify.app';

export const corsHeaders = {
  'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age': '86400',
};

export function handleOptions() {
  return { statusCode: 204, headers: corsHeaders, body: '' };
}
```

### [ALTA] SEC-22: Neon — conexión con SSL obligatorio y secrets en GitHub

```bash
# .env.example — siempre con sslmode=require
DATABASE_URL=postgresql://user:password@ep-xxx.neon.tech/dbname?sslmode=require&channel_binding=require

# En Netlify: usar GitHub Actions Secrets + Netlify CLI para deploy
# NO poner DATABASE_URL directamente en Netlify UI (no es auditable)
```

### [ALTA] SEC-23: Webhook endpoint en simulador con validación de firma y rate limiting

Ver SEC-11 (firma) y SEC-13 (rate limiting). El endpoint `/webhook` del simulador debe implementar ambos.

### [MEDIA] SEC-24: Neon — encriptar columnas sensibles en reposo

```typescript
// schema.ts — columnas sensibles encriptadas
export const webhookEvents = pgTable('webhook_events', {
  // ...
  // rawPayload encriptado a nivel de aplicación antes de persistir
  rawPayload: text('raw_payload'), // AES-256-GCM cifrado en app layer
});

// En la función que persiste:
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

function encryptPayload(data: object, key: Buffer): string {
  const iv = randomBytes(16);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(data)), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`;
}
```
- La clave de encriptación se almacena en Netlify env var `PAYLOAD_ENCRYPTION_KEY`, no en Neon.

---

## 9. Logging Seguro

### [CRÍTICA] SEC-25: LogSanitizer — implementar en todos los SDKs

```typescript
// shared/log-sanitizer.ts

// Campos que nunca deben aparecer en logs
const SENSITIVE_ATTRIBUTE_CODES = new Set([0, 3, 4]); // CardNumber, CVV, ExpirationDate
const SENSITIVE_FIELD_NAMES = new Set([
  'CardNumber', 'SecureCode', 'ExpirationDate', 'ApiKey', 'AuthResponse',
  'OneTimePassword', 'MobileNumber', // truncar, no eliminar
]);

export function sanitizeForLogging(obj: unknown): unknown {
  if (typeof obj === 'string') {
    return obj.replace(/\b\d{13,19}\b/g, '[REDACTED-PAN]');
  }
  if (Array.isArray(obj)) {
    return obj.map(item => {
      // PaymentInfoType / TokenInfoType items
      if (item && typeof item === 'object' && 'AttributeCode' in item) {
        if (SENSITIVE_ATTRIBUTE_CODES.has(item.AttributeCode)) {
          return { ...item, AttributeValue: '[REDACTED]' };
        }
        if (item.AttributeDesc === 'MobileNumber') {
          return { ...item, AttributeValue: '****' + String(item.AttributeValue).slice(-4) };
        }
      }
      return sanitizeForLogging(item);
    });
  }
  if (obj && typeof obj === 'object') {
    return Object.fromEntries(
      Object.entries(obj).map(([k, v]) => {
        if (SENSITIVE_FIELD_NAMES.has(k)) return [k, '[REDACTED]'];
        return [k, sanitizeForLogging(v)];
      })
    );
  }
  return obj;
}

// Wrapper de logger que sanitiza automáticamente
export const logger = {
  info:  (msg: string, data?: unknown) => console.info(msg,  sanitizeForLogging(data)),
  warn:  (msg: string, data?: unknown) => console.warn(msg,  sanitizeForLogging(data)),
  error: (msg: string, data?: unknown) => console.error(msg, sanitizeForLogging(data)),
  debug: (msg: string, data?: unknown) => {
    if (process.env.ECOLLECT_DEBUG === 'true') {
      console.debug(msg, sanitizeForLogging(data));
    }
  },
};
```

**Qué se loguea (sí) vs qué no:**
| Campo | Log en INFO | Log en DEBUG |
|---|---|---|
| TicketId | ✅ | ✅ |
| TranState | ✅ | ✅ |
| ReturnCode (error) | ✅ | ✅ |
| MerchantTransactionId | ✅ | ✅ |
| PaymentSystem | ✅ | ✅ |
| FiCode / FiName | ✅ | ✅ |
| TrazabilityCode | ✅ | ✅ |
| BankProcessDate | ✅ | ✅ |
| MobileNumber | ❌ | `****1234` |
| CardNumber (PAN) | ❌ | ❌ |
| CVV / SecureCode | ❌ | ❌ |
| ExpirationDate | ❌ | ❌ |
| AuthResponse | ❌ | texto interno |
| FailCode (raw) | ❌ | código interno |
| ApiKey | ❌ | ❌ |
| SessionToken completo | ❌ | primeros 8 chars + `...` |
| SubservicesArray | ❌ | solo cantidad |

---

## 10. Rate Limiting y Protección contra Abuso

### [MEDIA] SEC-26: Manejo de HTTP 429 y backoff en el SDK

```typescript
async function callWithRetry<T>(
  fn: () => Promise<T>,
  options: { maxRetries: number; baseDelayMs: number } = { maxRetries: 3, baseDelayMs: 1000 }
): Promise<T> {
  let attempt = 0;
  while (true) {
    try {
      return await fn();
    } catch (error) {
      const isRetryable = error.returnCode === 'FAIL_SYSTEM' || error.status === 429 || error.status >= 500;
      if (!isRetryable || attempt >= options.maxRetries) throw error;

      // Jitter para evitar thundering herd
      const jitter = Math.random() * 500;
      const delay = Math.pow(2, attempt) * options.baseDelayMs + jitter;
      await sleep(delay);
      attempt++;
    }
  }
}
```

### [MEDIA] SEC-27: tokenCommand — SessionToken exclusivo con cooldown

```typescript
// El SDK renueva SessionToken para cada tokenCommand
// pero con un cooldown mínimo para evitar flood a ecollect
class TokenCommandSession {
  private lastRefreshAt = 0;
  private readonly MIN_REFRESH_INTERVAL_MS = 200; // mínimo 200ms entre refreshes

  async getExclusiveToken(): Promise<string> {
    const now = Date.now();
    const elapsed = now - this.lastRefreshAt;
    if (elapsed < this.MIN_REFRESH_INTERVAL_MS) {
      await sleep(this.MIN_REFRESH_INTERVAL_MS - elapsed);
    }
    this.lastRefreshAt = Date.now();
    return await fetchNewSessionToken();
  }
}
```

---

## 11. Dependencias de Terceros

### [MEDIA] SEC-28: Dependencias mínimas por SDK y auditoría en CI/CD

**Dependencias aprobadas por SDK:**

| SDK | HTTP | JSON | Crypto | Validación |
|---|---|---|---|---|
| TypeScript | `fetch` nativo (Node 18+) | `JSON` nativo | `crypto` nativo | `validator` |
| PHP | `guzzlehttp/guzzle ^7.0` | `json_decode` nativo | `hash_hmac` nativo | — |
| Kotlin | `com.squareup.okhttp3:okhttp:4.x` | `kotlinx.serialization` | `javax.crypto` | — |
| Swift | `URLSession` nativo | `Codable` nativo | `CryptoKit` nativo | — |
| Python | `httpx>=0.27` | `json` nativo | `hmac` nativo | `email-validator` |

**CI/CD — auditoría automática de dependencias:**
```yaml
# .github/workflows/security.yml
- name: Audit TypeScript dependencies
  run: npm audit --audit-level=high
- name: Audit PHP dependencies
  run: composer audit
- name: Audit Python dependencies
  run: pip-audit
- name: Snyk scan (todos los SDKs)
  uses: snyk/actions@master
  with:
    command: test
```

---

## 12. Versionado y Política de Seguridad

### SEC-29: Política de seguridad y disclosure

**SECURITY.md (en raíz del monorepo):**
```markdown
## Reportar una vulnerabilidad

Reportar a: security@ecollect.com (no en issues públicos)
SLA de respuesta: 24h para vulnerabilidades críticas, 72h para el resto.
Patch release: dentro de 7 días hábiles para críticas, 30 días para otras.

## Versiones soportadas

| SDK Version | Soporte de seguridad |
|---|---|
| 1.x (actual) | ✅ Soporte completo |
| 0.x (beta) | ❌ Sin soporte |

## Changelog de seguridad

Los fixes de seguridad se marcan con `[SECURITY]` en CHANGELOG.md.
```

### SEC-30: EOL Policy

- Cada versión major recibe **soporte de seguridad por 12 meses** desde el release del siguiente major.
- Al llegar al EOL, el SDK muestra un warning en runtime: `"ecollect-sdk v1.x ha llegado al fin de soporte. Actualice a v2.x"`.

---

## Checklist de Seguridad por Fase de Desarrollo

### Antes de escribir código (Semana 0)
- [ ] Confirmar con ecollect el esquema de firma de webhooks (HMAC o verifySessionToken)
- [ ] Obtener hashes SHA-256 de certificados ecollect para certificate pinning
- [ ] Configurar Dependabot y Snyk en el monorepo
- [ ] Crear SECURITY.md con email de disclosure

### Semana 1 — TypeScript SDK
- [ ] Implementar LogSanitizer (SEC-25)
- [ ] Implementar PAN sanitizer en responses (SEC-04)
- [ ] Implementar PAN overwrite tras tokenCommand (SEC-05)
- [ ] Implementar verifyWebhookSignature con timingSafeEqual (SEC-11)
- [ ] Implementar idempotencia en webhook receiver (SEC-12)
- [ ] Implementar callWithRetry con jitter (SEC-26)
- [ ] Implementar CORS restrictivo en Netlify Functions (SEC-21)

### Semana 2 — PHP SDK
- [ ] Validar nonce CSRF en WooCommerce checkout (SEC-17)
- [ ] Prohibir `unserialize()` en webhook handler (SEC-18)
- [ ] Colocar logs fuera del web root con .htaccess (SEC-19)
- [ ] Escapar SavedCard data en admin (SEC-20)

### Semana 3 — Kotlin + Swift
- [ ] Implementar certificate pinning en OkHttp y URLSession (SEC-03)
- [ ] Implementar almacenamiento en EncryptedSharedPreferences / Keychain (SEC-14)
- [ ] Configurar App Links / Universal Links para callbacks (SEC-15)
- [ ] Incluir consumer-rules.pro en AAR (SEC-16)
- [ ] Documentar que PAN usa CharArray (no String) en Kotlin y SecureBytes en Swift (SEC-05)

### Semana 4 — GA Hardening
- [ ] OWASP Dependency Check en CI/CD para todos los SDKs (SEC-28)
- [ ] Auditoría PCI-DSS: verificar que PAN_REGEX detecta escapes en el 100% de paths
- [ ] Pen test del simulador (endpoint /webhook, CORS, rate limiting)
- [ ] Publicar SECURITY.md con política de disclosure
- [ ] Verificar que ningún log en ningún SDK contiene CardNumber o CVV
