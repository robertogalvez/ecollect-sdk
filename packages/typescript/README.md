# ecollect TypeScript/JavaScript SDK

Official TypeScript/JavaScript SDK for the [ecollect](https://www.e-collect.com) payment gateway — LatAm FinTech.

## Requirements

- Node.js 18+ (uses native `fetch`)

## Installation

```bash
npm install ecollect-sdk
```

## Quick Start

```typescript
import { EcollectClient } from 'ecollect-sdk';

const client = new EcollectClient({
  apiKey: 'your-private-api-key',
  etyCode: 12345,          // your merchant entity code
  environment: 'test',     // 'test' | 'prod'
  srvCode: 1,              // default service code
  logLevel: 'info',        // 'debug' | 'info' | 'warn' | 'error'
});

// Process a payment
const result = await client.payments.process({
  amount: 50000,
  currency: 'COP',
  srvCode: 1,
  customer: {
    fullName: 'Juan Pérez',
    email: 'juan@example.com',
    documentType: 'CC',
    documentNumber: '12345678',
    phone: '3001234567',
  },
  merchantTransactionId: 'ORDER-001',
  paymentSystem: '1',       // Credit card Colombia
  tokenId: 'tok_from_ecollect',
  secureCode: '123',
  installments: 1,
});

console.log(result.ticketId, result.tranState);
```

## Modules

### `client.session`

Manages session tokens with automatic caching and proactive refresh (refreshes when < 300s remain).

```typescript
const session = await client.session.create();
const token = await client.session.getActive(); // cached or refreshed
```

### `client.payments`

```typescript
// Standard payment
await client.payments.process(intent);

// Pre-authorization (reserve funds)
const preAuth = await client.payments.preAuthorize(intent);

// Capture pre-authorized amount
await client.payments.capture(preAuth.ticketId!, finalAmount);

// Void pre-authorization
await client.payments.void(preAuth.ticketId!);

// Hosted checkout (redirect user to ecollect page)
const result = await client.payments.hostedCheckout({
  ...intent,
  redirectUrl: 'https://yoursite.com/confirm',
});
// Redirect user to result.eCollectUrl
```

### `client.tokens`

```typescript
// Save card permanently
const saved = await client.tokens.save(cardData);

// Get temporary token (single payment, no save)
const temp = await client.tokens.get(cardData);

// Get hold token (for pre-authorization)
const hold = await client.tokens.hold(cardData);

// List saved cards
const cards = await client.tokens.list('user@example.com', 'doc-number');

// Delete a saved card
await client.tokens.delete(tokenId, 'user@example.com', 'doc-number');

// Update card expiry
await client.tokens.update(tokenId, '12/2030');
```

### `client.webhooks`

```typescript
// Verify HMAC signature of incoming webhook
const isValid = await client.webhooks.verifyWebhookSignature(
  req.body,
  req.headers['x-ecollect-signature'],
  process.env.WEBHOOK_SECRET!,
);

// Confirm webhook via ecollect API (verifySessionToken)
const txResult = await client.webhooks.confirmWebhook(webhookPayload, activeSessionToken);

// Return this from your webhook endpoint
return WebhooksModule.buildWebhookResponse(true); // { ReturnCode: 'SUCCESS' }
```

### `client.reconciliation`

```typescript
// Query current transaction state
const status = await client.reconciliation.getTransactionStatus(ticketId);

// Start polling until final state (or timeout)
const finalStatus = await client.reconciliation.reconciliate(ticketId, 600_000);

// Stop an in-progress poll
client.reconciliation.stopReconciliation(ticketId);
```

### `client.customers`

```typescript
// Get or create a persistent CustomerId for a customer
const customer = await client.customers.getOrCreateCustomerId({
  email: 'juan@example.com',
  fullName: 'Juan Pérez',
  documentType: 'CC',
  documentNumber: '12345678',
  mobileCountryCode: '57',
  mobileNumber: '3001234567',
});

// Update customer info
await client.customers.updateCustomerInfo(customer.customerId, { email: 'new@example.com' });
```

### `client.paymentSystems`

```typescript
const systems = await client.paymentSystems.getPaymentSystems();
// Returns array of PaymentSystem with FI lists and brand images
```

### `client.paymentLinks`

```typescript
// Email link (default)
const link = await client.paymentLinks.generatePaymentLink(intent, 'email');

// SMS
const smsLink = await client.paymentLinks.generatePaymentLink(
  { ...intent, customer: { ...intent.customer, mobileCountryCode: '57', mobileNumber: '3001234567' } },
  'sms',
);

// QR code
const qrLink = await client.paymentLinks.generatePaymentLink(
  { ...intent, qrLifetimeSecs: 3600 },
  'qr',
);
console.log(qrLink.eCollectUrl, qrLink.expiresAt);
```

## Error Handling

```typescript
import {
  EcollectError,
  SessionExpiredException,
  InvalidCardException,
  DuplicateTransactionException,
  NetworkRetryableException,
  ValidationException,
} from 'ecollect-sdk';

try {
  await client.payments.process(intent);
} catch (err) {
  if (err instanceof DuplicateTransactionException) {
    // Check transaction status before retrying
  } else if (err instanceof NetworkRetryableException) {
    // SDK already retried 3 times with exponential backoff
  } else if (err instanceof InvalidCardException) {
    // Show card error to user
  } else if (err instanceof EcollectError) {
    console.error(err.code, err.returnCode, err.message);
  }
}
```

## Double-Payment Prevention

States `BANK`, `PENDING`, `CAPTURED`, and `CREATED` indicate the user may already be paying. Never retry automatically in these states:

```typescript
const status = await client.reconciliation.getTransactionStatus(ticketId);
if (PaymentsModule.isDoublePaymentState(status.tranState!)) {
  // Wait for final state: OK, NOT_AUTHORIZED, EXPIRED, FAILED
  const final = await client.reconciliation.reconciliate(ticketId);
}
```

## Country-Specific Validation

```typescript
import { validateByCountry } from 'ecollect-sdk';

// Validate before processing
validateByCountry(intent, 'CO'); // Colombia: checks documentType, PSE requires userType
validateByCountry(intent, 'MX'); // Mexico: SPEI cannot have card data
validateByCountry(intent, 'DO'); // Dominican Republic: pre-auth only with AZUL
```

## Environments

| Environment | Session/Payments/Tokens URL                              | GetTransactionInfo URL                                      |
|-------------|----------------------------------------------------------|-------------------------------------------------------------|
| test        | `https://test1.e-collect.com/app_express/api`           | `https://test1.e-collect.com/app_express/api/getTransactionInformation` |
| prod        | `https://www.e-collect.com/app_Express/api`             | `https://m.e-collect.com/app_Express/api/GetTransactionInformation`     |

## Security Notes

- **ApiKey** must stay server-side. Never expose it in browser/mobile code.
- **SessionToken** can be passed to frontend for tokenisation flows.
- Card numbers (PAN) go directly from the user to ecollect — they never transit your server when using the token API.
- HMAC-SHA256 webhook verification uses constant-time comparison to prevent timing attacks.

## License

MIT
