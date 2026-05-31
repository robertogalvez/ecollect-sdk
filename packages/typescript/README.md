# ecollect TypeScript / JavaScript SDK

> **Official SDK for the ecollect LatAm payment gateway** — process cards, bank transfers (PSE / SPEI), save card tokens, reconcile transactions, and verify webhooks, all from Node.js or any modern JavaScript runtime.

---

## Table of Contents

1. [What is ecollect?](#1-what-is-ecollect)
2. [Prerequisites](#2-prerequisites)
3. [Installation](#3-installation)
4. [Setup — Initializing the Client](#4-setup--initializing-the-client)
5. [How Session Tokens Work](#5-how-session-tokens-work)
6. [Saving a Card Token](#6-saving-a-card-token)
7. [Listing Saved Tokens](#7-listing-saved-tokens)
8. [Processing a Payment](#8-processing-a-payment)
9. [Getting Available Payment Systems](#9-getting-available-payment-systems)
10. [Checking Transaction Status](#10-checking-transaction-status)
11. [Webhook Verification](#11-webhook-verification)
12. [Error Handling](#12-error-handling)
13. [Test vs Production](#13-test-vs-production)
14. [Full End-to-End Example](#14-full-end-to-end-example)
15. [TypeScript vs JavaScript Usage](#15-typescript-vs-javascript-usage)
16. [Common Errors](#16-common-errors)
17. [Frequently Asked Questions](#17-frequently-asked-questions)

---

## 1. What is ecollect?

ecollect is a LatAm-focused payment gateway that lets merchants accept credit cards, debit cards, bank transfers (PSE in Colombia, SPEI in Mexico), cash payments, and more — all through a single, unified API. This SDK wraps that API so you can integrate it in minutes without dealing with raw HTTP requests, session management, retry logic, or signature verification.

**The SDK handles everything for you:**
- Authenticating with your API credentials automatically
- Renewing expired session tokens transparently
- Retrying transient network errors with exponential back-off
- Mapping every API error code to a meaningful JavaScript exception
- Validating card numbers (Luhn check) and expiration dates before any network call

> ☁️ **Test environment note:** The test environment (`environment: 'test'`) **does not charge real money**. You can run every example in this guide safely. Your API key and entity code for the test environment come from the **ecollect merchant dashboard**.

---

## 2. Prerequisites

| Requirement | Minimum version | Notes |
|---|---|---|
| **Node.js** | 18.0.0 | Required for native `fetch` and `crypto.subtle` |
| **npm** | 8.x | Bundled with Node 18 |
| **Yarn** (optional) | 1.22+ | Alternative package manager |
| **TypeScript** (optional) | 5.0+ | The SDK ships with full `.d.ts` type declarations |

Check your Node version:

```bash
node --version
# Should print v18.x.x or higher
```

---

## 3. Installation

### Using npm

```bash
npm install ecollect-sdk
```

### Using Yarn

```bash
yarn add ecollect-sdk
```

### Using pnpm

```bash
pnpm add ecollect-sdk
```

After installation you will see `ecollect-sdk` in your `package.json` dependencies. No additional build step is required — the package ships pre-compiled.

---

## 4. Setup — Initializing the Client

The `EcollectClient` is the single entry point for everything in the SDK. You create it once and reuse it throughout your application (singleton pattern).

### TypeScript

```typescript
import { EcollectClient } from 'ecollect-sdk';

const client = new EcollectClient({
  // 🔑 Your private API key from the ecollect merchant dashboard
  apiKey: 'YOUR_API_KEY_HERE',

  // 🏪 Your entity/merchant code from the ecollect merchant dashboard
  etyCode: 50039,

  // 🌍 Environment: 'test' for development, 'prod' for live payments
  environment: 'test',

  // 🔢 Default service code (srvCode). You can override this per-payment.
  // Ask your ecollect account manager for this value.
  srvCode: 1001,

  // 📝 Log level: 'debug' | 'info' | 'warn' | 'error' (default: 'info')
  logLevel: 'info',

  // 🔄 How many times to retry failed requests automatically (default: 3)
  maxRetries: 3,

  // ⏱️ Delay in milliseconds before the first retry (doubles on each retry, default: 2000)
  initialBackoffMs: 2000,
});
```

### JavaScript (CommonJS)

```javascript
const { EcollectClient } = require('ecollect-sdk');

const client = new EcollectClient({
  apiKey: 'YOUR_API_KEY_HERE',
  etyCode: 50039,
  environment: 'test',
  srvCode: 1001,
});
```

### JavaScript (ESM)

```javascript
import { EcollectClient } from 'ecollect-sdk';

const client = new EcollectClient({
  apiKey: 'YOUR_API_KEY_HERE',
  etyCode: 50039,
  environment: 'test',
  srvCode: 1001,
});
```

### Config option reference

| Option | Type | Required | Default | Description |
|---|---|---|---|---|
| `apiKey` | `string` | ✅ Yes | — | Your private API key from the ecollect dashboard |
| `etyCode` | `number` | ✅ Yes | — | Your merchant/entity code from the ecollect dashboard |
| `environment` | `'test' \| 'prod'` | ✅ Yes | — | `'test'` for sandbox, `'prod'` for live |
| `srvCode` | `number` | No | `0` | Default service code; can be overridden per payment |
| `logLevel` | `'debug' \| 'info' \| 'warn' \| 'error'` | No | `'info'` | Controls how much the SDK logs to console |
| `maxRetries` | `number` | No | `3` | Max automatic retries on network errors |
| `initialBackoffMs` | `number` | No | `2000` | First retry delay in milliseconds |

> 💡 **Where do I find my API key and entity code?**
> Log in to the ecollect merchant dashboard. Your `apiKey` and `etyCode` are listed in the **API Credentials** section. If you don't have access, contact your ecollect account representative.

---

## 5. How Session Tokens Work

ecollect requires a short-lived **session token** for every API call. The SDK manages this completely automatically — you do not need to call `getSessionToken` yourself.

Here is what happens behind the scenes:

1. When you make the first API call (e.g., `client.payments.process(...)`), the SDK calls `getSessionToken` with your `apiKey` and `etyCode`.
2. The token is cached in memory.
3. On subsequent calls, the cached token is reused.
4. If the token expires mid-request, the SDK catches the `FAIL_APIEXPIREDSESSION` response, fetches a new token, and transparently retries the original call — you never see the error.

If you ever need to inspect or manually refresh the session token:

```typescript
// Get the current active session token (creates one if none exists)
const session = await client.session.getActive();
console.log('Session token:', session);

// Force the SDK to throw away the cached token and create a fresh one
client.session.invalidate();
const freshSession = await client.session.getActive();
console.log('Fresh token:', freshSession);
```

---

## 6. Saving a Card Token

Card tokenization lets you save a customer's card securely on ecollect's servers. You receive back a `tokenId` that you store in your own database. You never store the raw card number — ecollect does, safely.

### Full example: save a card

```typescript
import { EcollectClient } from 'ecollect-sdk';
import type { CardData, SavedCard } from 'ecollect-sdk';

const client = new EcollectClient({
  apiKey: 'YOUR_API_KEY_HERE',
  etyCode: 50039,
  environment: 'test',
});

// Build the card data object
const card: CardData = {
  // 💳 The full card number (the SDK validates it with Luhn before sending)
  cardNumber: '4296005885355275',

  // 📅 Expiration date in MM/YYYY format
  expirationDate: '12/2025',

  // 🔒 CVV / security code (optional but recommended)
  secureCode: '123',

  // 👤 Cardholder's full name exactly as it appears on the card
  cardHolderName: 'David Caballero',

  // 🪪 Document type: CC=Colombian ID, NIT=Tax ID, CI=Ecuador/Venezuela ID, CURP=Mexico, etc.
  cardHolderIdType: 'CC',

  // 🔢 The cardholder's document number
  cardHolderId: '123456799',

  // 💳 Payment system code:
  //   '1'  = Visa Colombia (CC)
  //   '3'  = VISANET Dominican Republic
  //   '6'  = CARDNET Dominican Republic
  paymentSystem: '1',

  // 🏦 Financial institution code (provided by ecollect; 190 = test bank)
  fiCode: '190',

  // 📧 Cardholder's email address
  email: 'david.caballero@ecollect.co',
};

// Save the card — returns a SavedCard with the tokenId
const savedCard: SavedCard = await client.tokens.save(card);

console.log('✅ Card saved successfully!');
console.log('Token ID:', savedCard.tokenId);       // Store this in your database!
console.log('Masked card:', savedCard.maskedCard); // e.g., "****5275"
console.log('Last 4 digits:', savedCard.last4);    // e.g., "5275"
console.log('Bank name:', savedCard.fiName);
console.log('Brand image URL:', savedCard.brandImageUrl);
```

### Other token commands

```typescript
// GET — get a temporary token without permanently saving the card
const tempToken = await client.tokens.get(card);
console.log('Temporary token (expires soon):', tempToken.tokenId);

// HOLD — get a hold token for pre-authorization flows
const holdToken = await client.tokens.hold(card);
console.log('Hold token:', holdToken.tokenId);

// UPDATE — update the expiration date of an existing saved token
const updatedCard = await client.tokens.update(
  'existing-token-id',  // The tokenId you stored earlier
  '06/2027',            // New expiration date
  '123456799',          // Cardholder document number (optional)
);
console.log('Updated expiry, token still valid:', updatedCard.tokenId);

// DELETE (REMOVE) — permanently delete a saved token
await client.tokens.delete(
  'existing-token-id',          // The tokenId to remove
  'david.caballero@ecollect.co', // Cardholder's email
  '123456799',                   // Cardholder's document number
);
console.log('Card token deleted.');
```

---

## 7. Listing Saved Tokens

To show a customer their saved payment methods (e.g., on a checkout page), call `queryToken`:

```typescript
import { EcollectClient } from 'ecollect-sdk';
import type { SavedCard } from 'ecollect-sdk';

const client = new EcollectClient({
  apiKey: 'YOUR_API_KEY_HERE',
  etyCode: 50039,
  environment: 'test',
});

// List all saved cards for a specific customer
// Both the email and document number are required for security
const savedCards: SavedCard[] = await client.tokens.list(
  'david.caballero@ecollect.co', // Customer's email
  '123456799',                    // Customer's document number
);

if (savedCards.length === 0) {
  console.log('This customer has no saved cards.');
} else {
  console.log(`Found ${savedCards.length} saved card(s):`);

  for (const card of savedCards) {
    console.log('---');
    console.log('Token ID:', card.tokenId);         // Use this for payments
    console.log('Masked card:', card.maskedCard);   // Show to the customer
    console.log('Last 4:', card.last4);
    console.log('Bank:', card.fiName);
    console.log('Status:', card.tokenStatus);       // 'ACTIVE' | 'VERIFY' | 'EXPIRED'
    console.log('Requires OTP:', card.requiresOneTimePassword);
  }
}
```

---

## 8. Processing a Payment

### 8.1 Payment with a new card (hosted checkout)

This creates a hosted checkout URL that you redirect the user to. ecollect handles the card form.

```typescript
import { EcollectClient } from 'ecollect-sdk';
import type { PaymentIntent, TransactionResult } from 'ecollect-sdk';

const client = new EcollectClient({
  apiKey: 'YOUR_API_KEY_HERE',
  etyCode: 50039,
  environment: 'test',
  srvCode: 1001, // Your default service code
});

const intent: PaymentIntent = {
  // 💰 Amount to charge (in the currency's main unit, e.g., 50000 = $50,000 COP)
  amount: 50000,

  // 🧾 Optional tax/VAT portion of the total
  vatAmount: 7983,

  // 💱 ISO 4217 currency code: COP, MXN, DOP, USD
  currency: 'COP',

  // 🔖 Your internal order/transaction ID (must be unique per transaction)
  merchantTransactionId: 'ORDER-2024-001',

  // 👤 Customer information
  customer: {
    fullName: 'David Caballero',
    email: 'david.caballero@ecollect.co',
    phone: '+1 311111111',
    documentType: 'CC',       // Colombian national ID
    documentNumber: '123456799',
  },

  // 🔀 URL ecollect redirects to after the customer pays on their page
  redirectUrl: 'https://yoursite.com/payment/success',

  // 🔔 URL ecollect POSTs the payment result to (your webhook endpoint)
  responseUrl: 'https://yoursite.com/webhooks/ecollect',

  // 🌐 Language for ecollect's payment page: 'ES' (Spanish) or 'EN' (English)
  langCode: 'ES',
};

const result: TransactionResult = await client.payments.process(intent);

console.log('Return code:', result.returnCode); // 'SUCCESS'
console.log('Ticket ID:', result.ticketId);     // Save this! Used to check status later.

// For hosted checkout, redirect the user to this URL
if (result.eCollectUrl) {
  console.log('Redirect user to:', result.eCollectUrl);
  // In Express: res.redirect(result.eCollectUrl)
  // In Next.js: router.push(result.eCollectUrl)
}
```

### 8.2 Payment with a saved card token (one-click checkout)

Once you have a `tokenId` from step 6, you can charge the card directly — the customer doesn't need to re-enter their card number.

```typescript
const intentWithToken: PaymentIntent = {
  amount: 50000,
  currency: 'COP',
  merchantTransactionId: 'ORDER-2024-002', // Must be unique each time

  customer: {
    fullName: 'David Caballero',
    email: 'david.caballero@ecollect.co',
    documentType: 'CC',
    documentNumber: '123456799',
  },

  // 🪙 The tokenId from client.tokens.save() or client.tokens.list()
  tokenId: 'the-token-id-you-saved-earlier',

  // The payment system and FI code associated with the saved card
  paymentSystem: '1',
  fiCode: '190',

  // 🔒 CVV (required for most card-present tokenized payments)
  secureCode: '123',

  // Optional: number of installments (cuotas)
  installments: 1,
};

const result = await client.payments.process(intentWithToken);
console.log('Payment status:', result.tranState); // 'OK' means approved!
console.log('Trazability code:', result.trazabilityCode);
```

### 8.3 Pre-authorization and capture

Pre-authorization reserves funds on the card without charging. Useful for hotels, car rentals, etc.

```typescript
// Step 1: Pre-authorize (reserve funds)
const preAuthResult = await client.payments.preAuthorize(intent);
const ticketId = preAuthResult.ticketId!;
console.log('Funds reserved. Ticket ID:', ticketId);

// Step 2: Later, capture the actual charge (can be less than or equal to pre-auth amount)
const captureResult = await client.payments.capture(ticketId, 45000); // Charge 45,000 instead of 50,000
console.log('Charged!', captureResult.tranState);

// Or cancel the reservation (void) without charging
await client.payments.void(ticketId);
console.log('Reservation cancelled, customer not charged.');
```

### Understanding TransactionResult fields

| Field | Description |
|---|---|
| `returnCode` | `'SUCCESS'` if the API call succeeded (does not mean the payment is approved!) |
| `ticketId` | ecollect's unique transaction ID — **save this in your database** |
| `tranState` | The payment outcome: `'OK'` = approved, `'NOT_AUTHORIZED'` = declined |
| `trazabilityCode` | Bank's reference number for reconciliation |
| `transValue` | Final charged amount |
| `bankProcessDate` | Date/time the bank processed the transaction |
| `eCollectUrl` | URL to redirect the user to for hosted checkout |

---

## 9. Getting Available Payment Systems

Display the available payment methods for your country/entity to the user:

```typescript
import { EcollectClient } from 'ecollect-sdk';

const client = new EcollectClient({
  apiKey: 'YOUR_API_KEY_HERE',
  etyCode: 50039,
  environment: 'test',
});

// Get the list of payment systems configured for your entity
const paymentSystems = await client.paymentSystems.list();

for (const ps of paymentSystems) {
  console.log('Payment system code:', ps.paymentSystem);
  // paymentSystem codes:
  //   '0'   = PSE (Colombian bank transfers)
  //   '1'   = Credit/debit cards (Colombia)
  //   '7'   = SPEI (Mexican bank transfers)
  //   '10'  = Payment link
  //   '100' = Cash payment

  console.log('Brand image:', ps.brandImageUrl); // Show this logo in your UI

  // For card systems, list available banks
  if (ps.financialInstitutions) {
    for (const fi of ps.financialInstitutions) {
      console.log(`  Bank: ${fi.fiName} (code: ${fi.fiCode})`);
    }
  }
}
```

---

## 10. Checking Transaction Status

After a payment, you can query its current state at any time using the `ticketId`:

```typescript
import { EcollectClient } from 'ecollect-sdk';

const client = new EcollectClient({
  apiKey: 'YOUR_API_KEY_HERE',
  etyCode: 50039,
  environment: 'test',
});

// Query a specific transaction by ticketId
const status = await client.reconciliation.getTransactionStatus(987654);

console.log('Transaction state:', status.tranState);
// Possible states:
//   'OK'             — Payment approved and settled ✅
//   'NOT_AUTHORIZED' — Bank declined the payment ❌
//   'PENDING'        — Still processing (e.g., PSE bank transfer in progress)
//   'BANK'           — Sent to bank, awaiting confirmation
//   'CAPTURED'       — Pre-auth was captured
//   'CREATED'        — Transaction created but not yet processed
//   'EXPIRED'        — Transaction expired without being paid
//   'FAILED'         — Technical failure

console.log('Amount charged:', status.transValue);
console.log('Currency:', status.payCurrency);
console.log('Bank reference:', status.trazabilityCode);

// You can also include your merchantTransactionId for cross-reference
const statusByOrderId = await client.reconciliation.getTransactionStatus(
  987654,
  'ORDER-2024-001', // Your merchantTransactionId
);
```

### Automatic polling (wait for final state)

For async payment methods like PSE or SPEI, the payment may take a few minutes. The SDK can poll automatically until a final state is reached:

```typescript
import { PollingTimeoutException } from 'ecollect-sdk';

try {
  // Wait up to 10 minutes for the transaction to reach a final state
  const finalResult = await client.reconciliation.reconciliate(
    987654,      // ticketId
    600_000,     // timeout in milliseconds (10 minutes)
  );

  if (finalResult.tranState === 'OK') {
    console.log('Payment completed successfully!');
  } else {
    console.log('Payment did not complete:', finalResult.tranState);
  }
} catch (err) {
  if (err instanceof PollingTimeoutException) {
    console.log('Timed out waiting. Check status manually later.');
  }
}
```

---

## 11. Webhook Verification

When a payment completes (or fails), ecollect sends a POST request to your `responseUrl`. You must verify that the request is genuinely from ecollect before trusting it.

### Setting up a webhook endpoint (Express.js example)

```typescript
import express from 'express';
import { EcollectClient, WebhookValidationException } from 'ecollect-sdk';
import type { WebhookPayload } from 'ecollect-sdk';

const app = express();
app.use(express.json());

const client = new EcollectClient({
  apiKey: 'YOUR_API_KEY_HERE',
  etyCode: 50039,
  environment: 'test',
});

app.post('/webhooks/ecollect', async (req, res) => {
  const payload = req.body as WebhookPayload;

  try {
    // Verify the webhook is genuine by calling ecollect's verifySessionToken API.
    // This checks that the SessionToken in the payload belongs to your entity.
    const sessionToken = await client.session.getActive();
    const result = await client.webhooks.confirmWebhook(payload, sessionToken);

    console.log('Webhook verified! Transaction state:', result.tranState);
    console.log('Ticket ID:', result.ticketId);
    console.log('Amount:', result.transValue, result.payCurrency);

    // Update your database based on result.tranState
    if (result.tranState === 'OK') {
      // Mark order as paid in your database
      await markOrderAsPaid(result.ticketId!, result.trazabilityCode!);
    }

    // IMPORTANT: You must respond with this exact JSON or ecollect will retry
    res.json({ ReturnCode: 'SUCCESS' });

  } catch (err) {
    if (err instanceof WebhookValidationException) {
      console.error('Invalid webhook — possible forgery attempt:', err.message);
      res.status(400).json({ ReturnCode: 'FAIL_SYSTEM' });
    } else {
      throw err;
    }
  }
});
```

### HMAC signature verification (optional additional layer)

If ecollect also sends an HMAC signature header, you can verify it:

```typescript
const isValid = await client.webhooks.verifyWebhookSignature(
  req.body,                              // The raw parsed JSON payload
  req.headers['x-ecollect-sig'] as string, // The signature header
  'YOUR_WEBHOOK_SECRET',                 // Your webhook secret from the dashboard
);

if (!isValid) {
  res.status(401).send('Invalid signature');
  return;
}
```

---

## 12. Error Handling

Every SDK error extends `EcollectError`, which extends the standard JavaScript `Error`. This means you can use normal `try/catch` blocks and check the specific error type.

```typescript
import {
  EcollectError,
  InvalidCardException,
  InsufficientFundsException,
  TokenNotFoundException,
  SessionExpiredException,
  ValidationException,
  NetworkRetryableException,
  DuplicateTransactionException,
  DuplicateInvoiceException,
  AuthenticationException,
  WebhookValidationException,
  CustomerNotFoundException,
  CardMismatchException,
  TicketNotFoundException,
  PollingTimeoutException,
  PolicyConfigException,
  InvalidConfigException,
} from 'ecollect-sdk';

try {
  const result = await client.payments.process(intent);
  // Handle success...
} catch (err) {

  if (err instanceof InvalidCardException) {
    // The card number failed Luhn validation, or the expiration date is wrong
    console.error('Card is invalid:', err.message);
    // Tell the user to check their card number and expiry date

  } else if (err instanceof InsufficientFundsException) {
    // The bank declined because the card has insufficient funds
    console.error('Insufficient funds');
    // Tell the user to try a different card

  } else if (err instanceof DuplicateTransactionException) {
    // merchantTransactionId was already used in another transaction
    console.error('Duplicate order ID — generate a new merchantTransactionId');

  } else if (err instanceof DuplicateInvoiceException) {
    // The invoice number already exists in another transaction
    console.error('Duplicate invoice:', err.message);

  } else if (err instanceof TokenNotFoundException) {
    // The tokenId provided does not exist or was already deleted
    console.error('Saved card not found — ask customer to re-enter card');

  } else if (err instanceof SessionExpiredException) {
    // This should rarely happen because the SDK retries automatically
    console.error('Session expired unexpectedly');

  } else if (err instanceof ValidationException) {
    // A required field is missing or has an invalid value
    console.error('Validation error:', err.message);

  } else if (err instanceof NetworkRetryableException) {
    // A temporary server-side error. The SDK already retried maxRetries times.
    console.error('ecollect is temporarily unavailable. Try again later.');

  } else if (err instanceof AuthenticationException) {
    // Your API key or entity code is wrong, or the merchant is blocked
    console.error('Authentication failed — check your API key and etyCode');

  } else if (err instanceof CardMismatchException) {
    // The card was already tokenized under a different user's account
    console.error('Card belongs to a different user');

  } else if (err instanceof PolicyConfigException) {
    // The policyCode is invalid or not configured for your entity
    console.error('Invalid policy code');

  } else if (err instanceof InvalidConfigException) {
    // You passed wrong values to EcollectClient constructor
    console.error('SDK misconfigured:', err.message);

  } else if (err instanceof EcollectError) {
    // Any other ecollect-specific error not caught above
    console.error(`ecollect error [${err.code}]:`, err.message);
    console.error('Raw return code:', err.returnCode);

  } else {
    // A genuine unexpected error (network outage, bug, etc.)
    throw err; // Re-throw so your global error handler sees it
  }
}
```

### Error class reference

| Class | Code | When it's thrown |
|---|---|---|
| `EcollectError` | varies | Base class for all SDK errors |
| `InvalidConfigException` | `INVALID_CONFIG` | Wrong constructor arguments |
| `SessionExpiredException` | `SESSION_EXPIRED` | Token expired (usually auto-recovered) |
| `ValidationException` | `VALIDATION_ERROR` | Missing/invalid field in your request |
| `InvalidCardException` | `INVALID_CARD` | Bad card number or expiration date |
| `InsufficientFundsException` | `INSUFFICIENT_FUNDS` | Bank declined for lack of funds |
| `NetworkRetryableException` | `NETWORK_RETRYABLE` | Temporary server error, retries exhausted |
| `TokenNotFoundException` | `TOKEN_NOT_FOUND` | Token ID does not exist |
| `TokenExpiredException` | `TOKEN_EXPIRED` | Token's linked card has expired |
| `TokenValidationException` | `TOKEN_VALIDATION` | Token request missing required fields |
| `DuplicateTransactionException` | `DUPLICATE_TRANSACTION` | `merchantTransactionId` already used |
| `DuplicateInvoiceException` | `DUPLICATE_INVOICE` | Invoice number already exists |
| `AuthenticationException` | `AUTHENTICATION_ERROR` | API key/entity code invalid or blocked |
| `WebhookValidationException` | `WEBHOOK_VALIDATION` | Webhook payload is forged or invalid |
| `CustomerNotFoundException` | `CUSTOMER_NOT_FOUND` | Customer ID does not exist |
| `CardMismatchException` | `CARD_MISMATCH` | Card linked to a different user |
| `TicketNotFoundException` | `TICKET_NOT_FOUND` | Ticket ID does not exist |
| `PollingTimeoutException` | `POLLING_TIMEOUT` | `reconciliate()` timed out |
| `PolicyConfigException` | `POLICY_CONFIG` | Invalid or unconfigured policy code |

---

## 13. Test vs Production

### Test environment

```typescript
const client = new EcollectClient({
  apiKey: 'YOUR_TEST_API_KEY',
  etyCode: 50039,          // Test entity code
  environment: 'test',     // Uses https://test1.e-collect.com/app_express/api/
});
```

- **Does NOT charge real money**
- Test card: `4296005885355275`, expiry `12/2025`, any CVV
- Test cardholder: David Caballero, CC 123456799, FiCode 190

### Production environment

```typescript
const client = new EcollectClient({
  apiKey: 'YOUR_PRODUCTION_API_KEY',  // Different key from test!
  etyCode: 12345,                      // Your real merchant entity code
  environment: 'prod',                 // Uses https://www.e-collect.com/app_Express/api/
});
```

> ⚠️ **Never hardcode production credentials in your source code.** Use environment variables:

```typescript
const client = new EcollectClient({
  apiKey: process.env.ECOLLECT_API_KEY!,
  etyCode: Number(process.env.ECOLLECT_ETY_CODE!),
  environment: (process.env.ECOLLECT_ENV ?? 'test') as 'test' | 'prod',
});
```

Your `.env` file (add to `.gitignore` — never commit this!):

```
ECOLLECT_API_KEY=your-secret-api-key
ECOLLECT_ETY_CODE=50039
ECOLLECT_ENV=test
```

> 📌 Note: in production, `getTransactionInformation` automatically uses `https://m.e-collect.com/app_Express/api/GetTransactionInformation` — the SDK handles this URL switch for you.

---

## 14. Full End-to-End Example

This is a complete, runnable script that covers: setup → save a card → pay with the saved card → check the transaction status.

```typescript
/**
 * ecollect SDK — complete end-to-end example
 *
 * Run with: npx ts-node example.ts
 * Or compile first: npx tsc && node dist/example.js
 */

import {
  EcollectClient,
  EcollectError,
  InvalidCardException,
  InsufficientFundsException,
} from 'ecollect-sdk';
import type { CardData, PaymentIntent } from 'ecollect-sdk';

// ─── 1. Initialize the client ─────────────────────────────────────────────
const client = new EcollectClient({
  apiKey: 'YOUR_TEST_API_KEY',      // From the ecollect merchant dashboard
  etyCode: 50039,                    // Your test entity code
  environment: 'test',               // Test environment — no real money charged
  srvCode: 1001,                     // Your default service code
  logLevel: 'info',
});

async function main() {
  // ─── 2. Save a card token ────────────────────────────────────────────────
  console.log('\n📦 Saving card token...');

  const card: CardData = {
    cardNumber: '4296005885355275',  // Test Visa card number
    expirationDate: '12/2025',       // MM/YYYY format
    secureCode: '123',               // CVV
    cardHolderName: 'David Caballero',
    cardHolderIdType: 'CC',          // CC = Colombian national ID
    cardHolderId: '123456799',
    paymentSystem: '1',              // '1' = Visa Colombia
    fiCode: '190',                   // Test financial institution code
    email: 'david.caballero@ecollect.co',
  };

  const savedCard = await client.tokens.save(card);
  console.log('✅ Card saved!');
  console.log('   Token ID:', savedCard.tokenId);   // Store this in your DB!
  console.log('   Masked:', savedCard.maskedCard);

  // ─── 3. List saved cards ─────────────────────────────────────────────────
  console.log('\n📋 Listing saved cards...');
  const cards = await client.tokens.list(
    'david.caballero@ecollect.co',
    '123456799',
  );
  console.log(`✅ Found ${cards.length} saved card(s).`);

  // ─── 4. Process a payment with the saved token ───────────────────────────
  console.log('\n💳 Processing payment...');

  const intent: PaymentIntent = {
    amount: 50000,                   // 50,000 Colombian pesos
    vatAmount: 7983,                 // VAT portion
    currency: 'COP',

    // Use Date.now() or a UUID library to guarantee uniqueness
    merchantTransactionId: `ORDER-${Date.now()}`,

    customer: {
      fullName: 'David Caballero',
      email: 'david.caballero@ecollect.co',
      phone: '+1 311111111',
      documentType: 'CC',
      documentNumber: '123456799',
    },

    // Use the token we just saved instead of asking for the card again
    tokenId: savedCard.tokenId,
    paymentSystem: '1',
    fiCode: '190',
    secureCode: '123',
    installments: 1,

    // ecollect sends the result here when the payment finalizes
    responseUrl: 'https://yoursite.com/webhooks/ecollect',
  };

  const result = await client.payments.process(intent);
  console.log('✅ Payment processed!');
  console.log('   Ticket ID:', result.ticketId);      // Store this in your DB!
  console.log('   State:', result.tranState);          // 'OK' = approved
  console.log('   Trazability:', result.trazabilityCode);

  // ─── 5. Check transaction status ─────────────────────────────────────────
  if (result.ticketId) {
    console.log('\n🔍 Checking transaction status...');
    const status = await client.reconciliation.getTransactionStatus(result.ticketId);
    console.log('   Final state:', status.tranState);
    console.log('   Amount charged:', status.transValue, status.payCurrency);
    console.log('   Bank date:', status.bankProcessDate);
  }

  // ─── 6. Get available payment systems ────────────────────────────────────
  console.log('\n🏦 Available payment systems:');
  const paymentSystems = await client.paymentSystems.list();
  for (const ps of paymentSystems) {
    console.log('  -', ps.paymentSystem, '→', ps.brandImageUrl ?? '(no image)');
  }

  console.log('\n🎉 All done!');
}

// ─── Run with error handling ────────────────────────────────────────────────
main().catch((err) => {
  if (err instanceof InvalidCardException) {
    console.error('❌ Invalid card:', err.message);
  } else if (err instanceof InsufficientFundsException) {
    console.error('❌ Insufficient funds');
  } else if (err instanceof EcollectError) {
    console.error(`❌ ecollect error [${err.code}]:`, err.message);
  } else {
    console.error('❌ Unexpected error:', err);
  }
  process.exit(1);
});
```

---

## 15. TypeScript vs JavaScript Usage

### TypeScript (recommended)

The SDK was written in TypeScript and ships full type declarations. You get autocomplete, inline documentation, and compile-time type checking for free.

```typescript
// TypeScript — full types available, catches mistakes at compile time
import { EcollectClient } from 'ecollect-sdk';
import type { PaymentIntent, TransactionResult, SavedCard } from 'ecollect-sdk';

const intent: PaymentIntent = {
  amount: 50000,
  currency: 'COP',
  customer: { fullName: 'David Caballero', email: 'david@example.com' },
  // TypeScript will show an error if you forget a required field
};

const result: TransactionResult = await client.payments.process(intent);
```

### JavaScript (ESM)

```javascript
// JavaScript ESM — no compile-time type checking, but same API
import { EcollectClient } from 'ecollect-sdk';

const client = new EcollectClient({
  apiKey: 'YOUR_API_KEY_HERE',
  etyCode: 50039,
  environment: 'test',
});

const result = await client.payments.process(intent);
```

### JavaScript (CommonJS)

```javascript
// JavaScript CommonJS (older Node.js style / require syntax)
const { EcollectClient } = require('ecollect-sdk');

const client = new EcollectClient({
  apiKey: 'YOUR_API_KEY_HERE',
  etyCode: 50039,
  environment: 'test',
});
```

> 💡 **Tip for CommonJS:** if you get `ERR_REQUIRE_ESM`, it means the SDK uses ES modules. Either switch to `import` syntax or use dynamic import: `const { EcollectClient } = await import('ecollect-sdk')`.

---

## 16. Common Errors

### "apiKey is required"

**Cause:** You passed an empty string or forgot `apiKey` in the constructor.

```typescript
// ❌ Wrong
const client = new EcollectClient({ apiKey: '', etyCode: 50039, environment: 'test' });

// ✅ Correct
const client = new EcollectClient({ apiKey: 'my-real-api-key', etyCode: 50039, environment: 'test' });
```

### "etyCode must be a positive integer"

**Cause:** You passed `0`, `null`, or a string as `etyCode`.

```typescript
// ❌ Wrong
const client = new EcollectClient({ apiKey: 'key', etyCode: 0, environment: 'test' });

// ✅ Correct
const client = new EcollectClient({ apiKey: 'key', etyCode: 50039, environment: 'test' });
```

### "srvCode is required"

**Cause:** You didn't set `srvCode` in the constructor or in `PaymentIntent`.

```typescript
// ✅ Option 1: set it in the constructor (applies to all payments)
const client = new EcollectClient({ ..., srvCode: 1001 });

// ✅ Option 2: set it per payment
const intent: PaymentIntent = { ..., srvCode: 1001 };
```

### "Card number is invalid (Luhn check failed)"

**Cause:** The card number you passed doesn't pass the Luhn algorithm. This is checked locally before any HTTP call.

```typescript
// Use the test card number:
cardNumber: '4296005885355275'
```

### `FAIL_INVALIDENTITYCODE`

**Cause:** Your `etyCode` is wrong or doesn't exist in the environment.

**Fix:** Double-check the entity code in your ecollect merchant dashboard. Test and production use different codes.

### `FAIL_ACCESSDENIED`

**Cause:** Your API key is wrong, has been revoked, or your merchant account is inactive.

**Fix:** Log into the ecollect dashboard, regenerate your API key, and update your `.env` file.

### `FAIL_MERCHANTRANSID`

**Cause:** You used the same `merchantTransactionId` twice.

**Fix:** Generate a unique ID for every transaction (e.g., `ORDER-${Date.now()}` or a UUID library).

---

## 17. Frequently Asked Questions

**Q: Do I need to call `getSessionToken` myself?**

No. The SDK calls it automatically before the first API request and refreshes it transparently when it expires. You never need to manage session tokens.

---

**Q: Where do I get my API key and entity code?**

Log into your ecollect merchant dashboard and navigate to **API Credentials**. Your `apiKey` and `etyCode` are displayed there. If you don't have dashboard access, contact your ecollect account representative.

---

**Q: Will the test environment charge my card?**

No. The test environment (`environment: 'test'`) is a complete sandbox and **never charges any card**. Use it freely during development.

---

**Q: Can I use the SDK in a browser (frontend)?**

The SDK is designed for **server-side** use (Node.js, serverless functions). Your `apiKey` must be kept secret and should never be exposed in browser code. If you need a frontend payment form, use ecollect's hosted checkout — redirect users to `result.eCollectUrl`.

---

**Q: What is a service code (`srvCode`)?**

A service code identifies a specific payment service configured for your merchant account (e.g., a particular currency, payment method, or settlement period). You get this value from ecollect when they configure your account. Most merchants have one default service code.

---

**Q: What is a financial institution code (`fiCode`)?**

For card payments, this identifies the card-acquiring bank. For PSE/SPEI bank transfers, it identifies the customer's bank. The full list of valid codes for your entity comes from `client.paymentSystems.list()`.

---

**Q: What happens if the network goes down mid-payment?**

The SDK retries `maxRetries` times (default: 3) with exponential back-off. If all retries fail, a `NetworkRetryableException` is thrown. Always check the transaction status via `getTransactionStatus(ticketId)` before retrying a payment — the original payment may have gone through despite the network error.

---

**Q: What is `merchantTransactionId` and must it be unique?**

It is your internal order/reference ID. ecollect stores it alongside the transaction so you can find it later by your own ID. It **must be unique per transaction** — if you reuse one, you will get a `DuplicateTransactionException`.

---

**Q: How do I handle PSE (Colombian bank transfer) payments?**

PSE payments are asynchronous — the customer is redirected to their bank's website. The flow is:

1. Call `client.payments.process(intent)` with `paymentSystem: '0'` (PSE) and a `redirectUrl`.
2. Redirect the user to `result.eCollectUrl`.
3. ecollect sends a webhook to your `responseUrl` when the bank confirms (or denies) the transfer.
4. Alternatively, poll with `client.reconciliation.reconciliate(ticketId)`.

---

*For further help, visit [https://www.e-collect.com](https://www.e-collect.com) or contact the ecollect support team.*
