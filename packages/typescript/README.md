# ecollect TypeScript SDK

![Node 18+](https://img.shields.io/badge/Node-18%2B-339933?logo=node.js) ![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript) ![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)

---

## 📖 What is this SDK?

The **ecollect TypeScript SDK** is an official client library that lets you integrate the ecollect LatAm payment gateway into any Node.js or TypeScript project with minimal boilerplate. It supports Colombia, Mexico, and the Dominican Republic, and handles session management, card tokenization, payments, and transaction reconciliation automatically — so you can focus on building your product.

---

## ✅ Prerequisites

Before you begin, make sure you have:

- **Node.js 18 or higher** — [Download here](https://nodejs.org/)
- **npm 9+** or **yarn 1.22+**
- An ecollect account with a valid **API Key** and **EntityCode** (provided by ecollect when you sign up)
- TypeScript 4.7+ if you are compiling your own project (the SDK ships its own `.d.ts` types — no `@types/` package needed)

---

## 📦 Installation

```bash
# Using npm
npm install ecollect-sdk

# Using yarn
yarn add ecollect-sdk
```

---

## ⚙️ Initial Setup

Create a client instance once at application startup and reuse it everywhere. Typically you do this in a shared module (e.g. `src/lib/ecollect.ts`):

```typescript
import { EcollectClient } from 'ecollect-sdk';

const client = new EcollectClient({
  // ─────────────────────────────────────────────────────────────────────────
  // REQUIRED — Your API key from the ecollect merchant dashboard
  apiKey: 'YOUR_API_KEY_HERE',

  // REQUIRED — Your entity code, assigned by ecollect (example: "50039")
  entityCode: 'YOUR_ENTITY_CODE',

  // OPTIONAL — Set to true to point at the TEST/sandbox environment.
  // Always develop with sandbox: true and only flip to false in production!
  // Default: false
  sandbox: true,

  // OPTIONAL — How long (in milliseconds) to wait for a response before
  // throwing a NetworkError. Default: 30000 (30 seconds)
  timeoutMs: 30000,

  // OPTIONAL — How many times the SDK automatically retries a failed
  // network request (e.g. a timeout) before giving up. Default: 2
  retries: 2,

  // OPTIONAL — Print verbose debug logs to the console.
  // Very helpful during development; disable in production. Default: false
  debug: false,
});

export default client;
```

---

## 🔑 How Session Tokens Work

ecollect uses a two-layer authentication model:

1. **API Key + EntityCode** — your static credentials, kept server-side only.
2. **SessionToken** — a short-lived token obtained by calling `getSessionToken`. It is included automatically in every API request.

**You do not need to manage session tokens manually.** Every time you call a method, the SDK:

1. Checks whether a `SessionToken` is cached in memory and still valid.
2. If not (or if it will expire soon), it automatically calls `getSessionToken` with your `apiKey` and `entityCode`.
3. The fresh token is cached and reused for all subsequent calls until it expires.

If you ever need the raw token value (e.g. to embed it in a front-end widget):

```typescript
// Manually request a session token — the SDK caches and reuses it
const tokenInfo = await client.getSessionToken();

console.log('SessionToken:', tokenInfo.sessionToken); // The token string
console.log('Expires at :', tokenInfo.expiresAt);     // ISO 8601 date string
```

---

## 💳 Save a Card Token

Tokenizing a card stores it securely on ecollect's PCI-compliant servers and returns a **token** you use for future payments — without ever handling raw card numbers again.

```typescript
import { EcollectClient, TokenCommandAction } from 'ecollect-sdk';

async function saveCard() {
  const result = await client.tokenCommand({
    // ── What operation to perform ─────────────────────────────────────────
    // TokenCommandAction.SAVE   → store a new card and get back a token
    // TokenCommandAction.GET    → retrieve stored card info by token
    // TokenCommandAction.REMOVE → permanently delete a stored token
    // TokenCommandAction.UPDATE → update card details (e.g. new expiry)
    // TokenCommandAction.HOLD   → temporarily freeze a token without deleting it
    action: TokenCommandAction.SAVE,

    // ── Card details ──────────────────────────────────────────────────────
    cardNumber: '4296005885355275',    // Full 16-digit card PAN — TEST card number
    expirationDate: '12/2025',          // Must be MM/YYYY format
    paymentSystem: '1',                 // 1 = Visa  |  2 = Mastercard  (from getPaymentSystem)

    // ── Card holder identity ──────────────────────────────────────────────
    cardHolderName: 'David Caballero',  // Exactly as printed on the card
    cardHolderIdType: 'CC',             // CC = Colombian cédula  |  CE = foreigner ID
                                         // NIT = company ID  |  PP = passport
    cardHolderId: '123456799',           // Government-issued ID number

    // ── Contact information ───────────────────────────────────────────────
    email: 'david.caballero@ecollect.co', // Cardholder email (used for receipts/lookup)
    mobileCountryCode: '1',               // Country dialing code without "+" (Colombia = 57)
    mobileNumber: '311111111',             // Mobile phone number (no country code)

    // ── Financial institution ─────────────────────────────────────────────
    // FiCode identifies the issuing bank or network. Use 190 in the test environment.
    fiCode: '190',

    // ── CVV ───────────────────────────────────────────────────────────────
    // Only required when your merchant risk settings demand it for SAVE.
    // NEVER store this value yourself — pass it directly here and discard it.
    cvv: '123',
  });

  // result.token — store this in your database to charge later
  console.log('Card saved! Token:', result.token);
}

saveCard();
```

---

## 🔍 Query Saved Tokens

Retrieve all cards previously saved for a specific cardholder — useful for showing a "select saved card" screen:

```typescript
async function listCards() {
  const cards = await client.queryToken({
    // Search by email address ...
    email: 'david.caballero@ecollect.co',

    // ... OR search by document type + number:
    // cardHolderIdType: 'CC',
    // cardHolderId: '123456799',
  });

  for (const card of cards) {
    console.log(`Token   : ${card.token}`);
    console.log(`Brand   : ${card.paymentSystem}`);  // e.g. "Visa"
    console.log(`Last 4  : ${card.lastFour}`);         // e.g. "5275"
    console.log(`Expires : ${card.expirationDate}`);
    console.log('---');
  }
}
```

---

## 💰 Process a Payment

### Option A — Pay with a saved token (recommended)

```typescript
import { PaymentIntent } from 'ecollect-sdk';

async function chargeToken(savedToken: string) {
  const intent: PaymentIntent = {
    // ── Amount ────────────────────────────────────────────────────────────
    amount: 50000,        // In the smallest currency unit:
                           // COP → centavos (50000 = $500 COP)
                           // MXN → centavos  |  DOP → centavos
    currency: 'COP',       // ISO 4217: 'COP' | 'MXN' | 'DOP'

    // ── Token from previous tokenCommand SAVE ─────────────────────────────
    token: savedToken,

    // ── Order identification (must be unique per transaction) ─────────────
    orderId: `ORDER-${Date.now()}`,
    description: 'Premium subscription — monthly',

    // ── Cardholder info (must match what was used when saving the token) ──
    cardHolderName: 'David Caballero',
    cardHolderIdType: 'CC',
    cardHolderId: '123456799',
    email: 'david.caballero@ecollect.co',
    mobileCountryCode: '1',
    mobileNumber: '311111111',

    // ── CVV re-entry (optional — depends on your merchant risk config) ─────
    cvv: '123',
  };

  const payment = await client.createTransactionPayment(intent);

  if (payment.approved) {
    console.log('✅ Payment approved!');
    console.log('   Reference:', payment.transactionReference); // Save this for reconciliation
    console.log('   Auth code:', payment.authorizationCode);
  } else {
    console.log('❌ Payment declined:', payment.responseMessage);
  }
}
```

### Option B — Pay without a token (one-shot card entry)

Use this when you do not want to store a token. Pass raw card details instead:

```typescript
const payment = await client.createTransactionPayment({
  amount: 50000,
  currency: 'COP',
  orderId: `ORDER-${Date.now()}`,
  description: 'One-time purchase',

  // Card details (instead of a token)
  cardNumber: '4296005885355275',
  expirationDate: '12/2025',
  paymentSystem: '1',
  cvv: '123',
  fiCode: '190',

  // Cardholder
  cardHolderName: 'David Caballero',
  cardHolderIdType: 'CC',
  cardHolderId: '123456799',
  email: 'david.caballero@ecollect.co',
  mobileCountryCode: '1',
  mobileNumber: '311111111',
});
```

---

## 🏦 Get Available Payment Systems

Retrieve the list of payment methods enabled for your entity (Visa, Mastercard, PSE, SPEI, etc.) so you can display them in your checkout UI:

```typescript
async function listPaymentMethods() {
  const methods = await client.getPaymentSystem();

  for (const method of methods) {
    // method.id          → the paymentSystem code used in tokenCommand / createTransactionPayment
    // method.name        → human-readable name: "Visa", "Mastercard", "PSE", "SPEI", etc.
    // method.active      → boolean: whether this method is currently available
    // method.countries   → array of ISO country codes where it is available
    console.log(`[${method.id}] ${method.name} — active: ${method.active}`);
  }
}
```

---

## 🔄 Check Transaction Status

Use this for post-payment reconciliation — verify whether a transaction was ultimately approved, rejected, or is still pending:

```typescript
async function checkStatus(transactionReference: string) {
  const info = await client.getTransactionInformation({ transactionReference });

  console.log('Status         :', info.status);           // 'APPROVED' | 'REJECTED' | 'PENDING'
  console.log('Amount         :', info.amount);
  console.log('Currency       :', info.currency);
  console.log('Transaction date:', info.transactionDate); // ISO date string
  console.log('Auth code      :', info.authorizationCode);
  console.log('Response msg   :', info.responseMessage);
}
```

> **Note:** In production, `getTransactionInformation` automatically uses the special endpoint
> `https://m.e-collect.com/app_Express/api/GetTransactionInformation`.
> You do not need to change anything — the SDK switches URLs based on the `sandbox` flag.

---

## 🔔 Webhook Verification

When ecollect sends an asynchronous notification (webhook) to your server, verify its authenticity before processing the event:

```typescript
import express from 'express';
import client from './lib/ecollect'; // your shared client instance

const app = express();

// IMPORTANT: use express.raw() — not express.json() — to get the raw body for signature check
app.post('/webhooks/ecollect', express.raw({ type: 'application/json' }), async (req, res) => {
  const rawBody  = req.body as Buffer;
  const signature = req.headers['x-ecollect-signature'] as string;

  try {
    // verifySessionToken validates the HMAC-SHA256 signature sent by ecollect
    // and returns the decoded payload if valid.
    const payload = await client.verifySessionToken(rawBody, signature);

    console.log('✅ Webhook verified. Event type:', payload.eventType);
    console.log('   Transaction ref:', payload.transactionReference);

    // Update your order status in the database based on payload.status
    // e.g. if (payload.status === 'APPROVED') { markOrderPaid(payload.orderId); }

    res.status(200).json({ received: true });
  } catch (err) {
    // If verification throws, the signature is invalid — reject the request
    console.error('❌ Invalid webhook signature:', err);
    res.status(400).send('Invalid signature');
  }
});

app.listen(3000);
```

---

## ⚠️ Error Handling

All SDK errors extend the base `EcollectError` class. Always wrap your calls in `try/catch`:

```typescript
import {
  EcollectError,         // 🔴 Base class — catches any SDK error you don't handle specifically
  AuthenticationError,   // Thrown when: API key or EntityCode is wrong, missing, or expired
  ValidationError,       // Thrown when: a required field is missing or in the wrong format
  PaymentDeclinedError,  // Thrown when: the card issuer rejected the transaction
  NetworkError,          // Thrown when: request timed out or server was unreachable
  TokenNotFoundError,    // Thrown when: the token you referenced does not exist
  RateLimitError,        // Thrown when: too many API requests in a short time window
  ServerError,           // Thrown when: ecollect returned an unexpected 5xx HTTP error
} from 'ecollect-sdk';

try {
  const payment = await client.createTransactionPayment({ /* ... */ });
} catch (err) {
  if (err instanceof AuthenticationError) {
    // ➡ Re-check your apiKey and entityCode. Are you using sandbox credentials in production?
    console.error('Bad credentials:', err.message);

  } else if (err instanceof ValidationError) {
    // ➡ err.fields is an array of { field, message } objects showing what is wrong
    console.error('Invalid fields:', err.fields);

  } else if (err instanceof PaymentDeclinedError) {
    // ➡ Do NOT retry automatically. Show a user-friendly message.
    console.error('Declined — code:', err.responseCode, '— reason:', err.responseMessage);

  } else if (err instanceof NetworkError) {
    // ➡ Safe to retry after a short delay (the SDK already retried `retries` times)
    console.error('Network problem:', err.message);

  } else if (err instanceof TokenNotFoundError) {
    // ➡ The token was deleted or never created. Ask the user to re-enter their card.
    console.error('Token not found — please re-enter card details');

  } else if (err instanceof RateLimitError) {
    // ➡ Implement exponential back-off. err.retryAfterMs is the suggested wait time.
    console.error('Rate limited. Try again in:', err.retryAfterMs, 'ms');

  } else if (err instanceof ServerError) {
    // ➡ Log err.statusCode and err.rawBody, then contact ecollect support
    console.error('ecollect server error:', err.statusCode, err.rawBody);

  } else if (err instanceof EcollectError) {
    // ➡ Unexpected SDK error — log it and investigate
    console.error('Unexpected ecollect error:', err.message);

  } else {
    throw err; // Re-throw anything that is not an SDK error
  }
}
```

---

## 🌍 Test vs Production

| Setting | Test (Sandbox) | Production |
|---|---|---|
| `sandbox` option | `true` | `false` |
| Base URL | `https://test1.e-collect.com/app_express/api/` | `https://www.e-collect.com/app_Express/api/` |
| GetTransactionInformation URL | same base URL | `https://m.e-collect.com/app_Express/api/GetTransactionInformation` |
| Test card number | `4296005885355275` | Real cards only |
| EntityCode example | `50039` | Your production EntityCode |
| Charges real money? | ❌ No | ✅ Yes |

> The SDK selects the correct URLs automatically based on `sandbox`. You never need to hardcode any URL.

---

## 📋 Complete End-to-End Script

Copy this and run it with `ts-node index.ts` or `npx tsx index.ts` to see everything working together:

```typescript
import {
  EcollectClient,
  TokenCommandAction,
  PaymentIntent,
  EcollectError,
  PaymentDeclinedError,
  ValidationError,
} from 'ecollect-sdk';

// ── 1. Initialize the client in sandbox mode ──────────────────────────────────
const client = new EcollectClient({
  apiKey: 'YOUR_API_KEY',       // Replace with your real test API key
  entityCode: '50039',           // Replace with your real entity code
  sandbox: true,                 // ← IMPORTANT: test environment
  debug: true,                   // ← Shows helpful logs during development
});

async function main() {
  try {
    // ── 2. See what payment methods are available ──────────────────────────
    console.log('\n🏦 Available payment methods:');
    const methods = await client.getPaymentSystem();
    methods.forEach(m => console.log(`  [${m.id}] ${m.name} — active: ${m.active}`));

    // ── 3. Save a card token ───────────────────────────────────────────────
    console.log('\n💳 Saving card...');
    const tokenResult = await client.tokenCommand({
      action: TokenCommandAction.SAVE,
      cardNumber: '4296005885355275',
      expirationDate: '12/2025',
      paymentSystem: '1',
      cvv: '123',
      cardHolderName: 'David Caballero',
      cardHolderIdType: 'CC',
      cardHolderId: '123456799',
      email: 'david.caballero@ecollect.co',
      mobileCountryCode: '1',
      mobileNumber: '311111111',
      fiCode: '190',
    });
    const token = tokenResult.token;
    console.log('  Saved token:', token);

    // ── 4. List all tokens for this cardholder ─────────────────────────────
    console.log('\n🔍 Querying saved tokens for david.caballero@ecollect.co:');
    const cards = await client.queryToken({ email: 'david.caballero@ecollect.co' });
    cards.forEach(c => console.log(`  Token: ${c.token}  |  Last4: ${c.lastFour}  |  Brand: ${c.paymentSystem}`));

    // ── 5. Create a payment using the saved token ──────────────────────────
    console.log('\n💰 Creating payment...');
    const intent: PaymentIntent = {
      amount: 50000,          // 500.00 COP
      currency: 'COP',
      token,
      orderId: `ORDER-${Date.now()}`, // Unique order ID
      description: 'Test purchase via ecollect SDK',
      cardHolderName: 'David Caballero',
      cardHolderIdType: 'CC',
      cardHolderId: '123456799',
      email: 'david.caballero@ecollect.co',
      mobileCountryCode: '1',
      mobileNumber: '311111111',
    };

    const payment = await client.createTransactionPayment(intent);

    if (payment.approved) {
      console.log('  ✅ Payment approved!');
      console.log('     Reference:', payment.transactionReference);
      console.log('     Auth code:', payment.authorizationCode);

      // ── 6. Verify the transaction status ──────────────────────────────────
      console.log('\n🔄 Checking transaction status...');
      const info = await client.getTransactionInformation({
        transactionReference: payment.transactionReference,
      });
      console.log('  Status:', info.status);
      console.log('  Amount:', info.amount, info.currency);
      console.log('  Date  :', info.transactionDate);
    } else {
      console.log('  ❌ Payment declined:', payment.responseMessage);
    }

    // ── 7. Clean up — remove the test token ───────────────────────────────
    console.log('\n🗑️  Removing token...');
    await client.tokenCommand({ action: TokenCommandAction.REMOVE, token });
    console.log('  Done.');

  } catch (err) {
    if (err instanceof ValidationError) {
      console.error('\n🚨 Validation error:', err.fields);
    } else if (err instanceof PaymentDeclinedError) {
      console.error('\n🚨 Payment declined:', err.responseMessage);
    } else if (err instanceof EcollectError) {
      console.error('\n🚨 SDK error:', err.message);
    } else {
      throw err;
    }
  }
}

main();
```

---

## ❓ FAQ

**Q1: Do I need to call `getSessionToken` before every request?**
No. The SDK manages the session token automatically. It fetches a new one only when the current one is missing or about to expire. You only call `getSessionToken` directly if you need to pass the raw token to a front-end widget.

**Q2: What currency codes are supported?**
`COP` (Colombian peso), `MXN` (Mexican peso), `DOP` (Dominican peso). Always use the ISO 4217 three-letter code.

**Q3: Can I save multiple cards for the same customer?**
Yes. Each `tokenCommand({ action: SAVE, ... })` call returns a new unique token. Store all tokens in your database linked to the customer, and let the user pick which card to charge.

**Q4: Is the CVV stored by ecollect?**
No. ecollect never stores the CVV. You pass it for a single authorization and it is discarded immediately after.

**Q5: How do I switch from sandbox to production?**
Change `sandbox: true` to `sandbox: false` and replace your test API key / EntityCode with your production credentials. No URL changes are needed — the SDK handles that.

**Q6: What happens if the session token expires mid-request?**
The SDK detects the 401 response, automatically fetches a new session token, and retries the original request once. This is completely transparent to your code.

**Q7: Can I use this SDK in a serverless function (AWS Lambda, Vercel, etc.)?**
Yes. The in-memory session token cache does not persist across cold starts, so each cold start will make one extra call to fetch a session token. This is safe and typically adds only a few hundred milliseconds on the first request.

**Q8: Which Node.js versions are supported?**
Node.js 18 and above. The SDK uses the native `fetch` API available since Node 18.

---

## 🐛 Common Errors and Fixes

| Error | Likely Cause | Fix |
|---|---|---|
| `AuthenticationError: Invalid API key` | Wrong or expired credentials | Double-check `apiKey` and `entityCode`; make sure sandbox/production keys match the environment |
| `ValidationError: cardNumber is required` | Missing required field | Check all required fields in the `tokenCommand` or `createTransactionPayment` call |
| `ValidationError: expirationDate format invalid` | Wrong date format | Use `MM/YYYY` exactly, e.g. `12/2025` |
| `PaymentDeclinedError: CARD_DECLINED` | Issuer rejected the card | Show a user-friendly message; do not retry automatically |
| `NetworkError: ECONNREFUSED` | Wrong environment or firewall | Check the `sandbox` flag; verify network access to ecollect servers |
| `TokenNotFoundError` | Token was deleted or never created | Re-run `tokenCommand SAVE` to create a new token |
| `RateLimitError` | Too many requests per minute | Add exponential back-off; contact ecollect to raise your rate limit |
| `ServerError: 503` | ecollect service temporarily down | Retry after 30–60 seconds; monitor the ecollect status page |
