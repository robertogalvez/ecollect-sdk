# ecollect PHP SDK

> **Official PHP SDK for the ecollect LatAm payment gateway** — process cards, bank transfers (PSE / SPEI), save card tokens, reconcile transactions, and verify webhooks, all from any PHP application.

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
11. [Webhook Signature Verification](#11-webhook-signature-verification)
12. [Error Handling](#12-error-handling)
13. [Test vs Production](#13-test-vs-production)
14. [Full End-to-End Example](#14-full-end-to-end-example)
15. [Common Errors](#15-common-errors)
16. [Frequently Asked Questions](#16-frequently-asked-questions)

---

## 1. What is ecollect?

ecollect is a LatAm-focused payment gateway that lets merchants accept credit cards, debit cards, bank transfers (PSE in Colombia, SPEI in Mexico), cash payments, and more — all through a single, unified API. This SDK wraps that API so you can integrate it in minutes without dealing with raw HTTP requests, session management, retry logic, or signature verification.

**The SDK handles everything for you:**
- Authenticating with your API credentials automatically
- Renewing expired session tokens transparently
- Retrying transient network errors with exponential back-off
- Mapping every API error code to a meaningful PHP exception
- Validating card numbers (Luhn check) and expiration dates before any network call

> ☁️ **Test environment note:** The test environment (`'environment' => 'test'`) **does not charge real money**. You can run every example in this guide safely. Your API key and entity code for the test environment come from the **ecollect merchant dashboard**.

---

## 2. Prerequisites

| Requirement | Minimum version | Notes |
|---|---|---|
| **PHP** | 7.4 | Required for typed properties and null coalescing |
| **Composer** | 2.x | PHP dependency manager |
| **ext-json** | any | Usually enabled by default |
| **ext-curl** | any | Required by Guzzle HTTP client |

Check your PHP version:

```bash
php --version
# Should print PHP 7.4.x or higher
```

Check Composer is installed:

```bash
composer --version
# Should print Composer version 2.x.x
```

If Composer is not installed, download it from [https://getcomposer.org](https://getcomposer.org).

---

## 3. Installation

Run the following command inside your project directory:

```bash
composer require ecollect/sdk
```

Composer will automatically install the SDK and its only runtime dependency, [Guzzle HTTP](https://docs.guzzlephp.org) (a popular HTTP client for PHP).

After installation your `composer.json` will include:

```json
{
    "require": {
        "ecollect/sdk": "^1.0"
    }
}
```

Make sure your PHP files include the Composer autoloader at the top:

```php
<?php

// This one line loads the SDK and all its classes automatically
require_once __DIR__ . '/vendor/autoload.php';
```

---

## 4. Setup — Initializing the Client

`EcollectClient` is the single entry point for everything in the SDK. Create it once and reuse it throughout your application.

```php
<?php

require_once __DIR__ . '/vendor/autoload.php';

use Ecollect\EcollectClient;

$client = new EcollectClient([
    // 🔑 Your private API key from the ecollect merchant dashboard
    'api_key'     => 'YOUR_API_KEY_HERE',

    // 🏪 Your entity/merchant code from the ecollect merchant dashboard
    'ety_code'    => 50039,

    // 🌍 Environment: 'test' for development, 'prod' for live payments
    'environment' => 'test',

    // 🔢 Default service code. You can override this per-payment.
    // Ask your ecollect account manager for this value.
    'srv_code'    => 1001,

    // 📝 Log level: 'debug', 'info', 'warn', or 'error' (default: 'info')
    'log_level'   => 'info',

    // 🔄 How many times to retry failed requests automatically (default: 3)
    'max_retries' => 3,

    // ⏱️ Delay in milliseconds before the first retry (doubles on each retry, default: 2000)
    'initial_backoff_ms' => 2000,
]);
```

### Config option reference

| Key | Type | Required | Default | Description |
|---|---|---|---|---|
| `api_key` | `string` | ✅ Yes | — | Your private API key from the ecollect dashboard |
| `ety_code` | `int` | ✅ Yes | — | Your merchant/entity code from the ecollect dashboard |
| `environment` | `string` | ✅ Yes | — | `'test'` for sandbox, `'prod'` for live |
| `srv_code` | `int` | No | `0` | Default service code; can be overridden per payment |
| `log_level` | `string` | No | `'info'` | Controls how much the SDK logs |
| `max_retries` | `int` | No | `3` | Max automatic retries on network errors |
| `initial_backoff_ms` | `int` | No | `2000` | First retry delay in milliseconds |

> 💡 **Where do I find my API key and entity code?**
> Log in to the ecollect merchant dashboard. Your `api_key` and `ety_code` are listed in the **API Credentials** section. If you don't have access, contact your ecollect account representative.

---

## 5. How Session Tokens Work

ecollect requires a short-lived **session token** for every API call. The SDK manages this completely automatically — you do not need to call `getSessionToken` yourself.

Here is what happens behind the scenes:

1. When you make the first API call (e.g., `$client->payments->process($intent)`), the SDK calls `getSessionToken` with your `api_key` and `ety_code`.
2. The token is cached in memory for the duration of the request.
3. On subsequent calls, the cached token is reused.
4. If the token expires mid-request, the SDK catches the `FAIL_APIEXPIREDSESSION` response, fetches a new token, and transparently retries the original call.

If you ever need to inspect or manually refresh the session token:

```php
<?php

// Get the current active session token (creates one if none exists)
$sessionToken = $client->session->getActive();
echo 'Session token: ' . $sessionToken . PHP_EOL;

// Force the SDK to throw away the cached token and create a fresh one
$client->session->invalidate();
$freshToken = $client->session->getActive();
echo 'Fresh token: ' . $freshToken . PHP_EOL;
```

---

## 6. Saving a Card Token

Card tokenization lets you save a customer's card securely on ecollect's servers. You receive back a `tokenId` that you store in your own database. You never store the raw card number — ecollect does, safely.

### Full example: save a card

```php
<?php

require_once __DIR__ . '/vendor/autoload.php';

use Ecollect\EcollectClient;
use Ecollect\Types\SavedCard;

$client = new EcollectClient([
    'api_key'     => 'YOUR_API_KEY_HERE',
    'ety_code'    => 50039,
    'environment' => 'test',
]);

// Build the card data array
$cardData = [
    // 💳 The full card number (the SDK validates it with Luhn before sending)
    'cardNumber'        => '4296005885355275',

    // 📅 Expiration date in MM/YYYY format
    'expirationDate'    => '12/2025',

    // 🔒 CVV / security code (optional but recommended)
    'secureCode'        => '123',

    // 👤 Cardholder's full name exactly as it appears on the card
    'cardHolderName'    => 'David Caballero',

    // 🪪 Document type: CC=Colombian ID, NIT=Tax ID, CI=Ecuador/Venezuela, CURP=Mexico
    'cardHolderIdType'  => 'CC',

    // 🔢 The cardholder's document number
    'cardHolderId'      => '123456799',

    // 💳 Payment system code:
    //   '1' = Visa Colombia (CC)
    //   '3' = VISANET Dominican Republic
    //   '6' = CARDNET Dominican Republic
    'paymentSystem'     => '1',

    // 🏦 Financial institution code (provided by ecollect; 190 = test bank)
    'fiCode'            => '190',

    // 📧 Cardholder's email address
    'email'             => 'david.caballero@ecollect.co',
];

// Save the card — returns an array with the tokenId and card details
$savedCard = $client->tokens->save($cardData);

echo '✅ Card saved successfully!' . PHP_EOL;
echo 'Token ID: ' . $savedCard['tokenId'] . PHP_EOL;       // Store this in your database!
echo 'Masked card: ' . ($savedCard['maskedCard'] ?? '') . PHP_EOL; // e.g., "****5275"
echo 'Last 4 digits: ' . ($savedCard['last4'] ?? '') . PHP_EOL;
echo 'Bank name: ' . ($savedCard['fiName'] ?? '') . PHP_EOL;
echo 'Brand image URL: ' . ($savedCard['brandImageUrl'] ?? '') . PHP_EOL;
```

### Other token commands

```php
<?php

// GET — get a temporary token without permanently saving the card
$tempToken = $client->tokens->get($cardData);
echo 'Temporary token (expires soon): ' . $tempToken['tokenId'] . PHP_EOL;

// HOLD — get a hold token for pre-authorization flows
$holdToken = $client->tokens->hold($cardData);
echo 'Hold token: ' . $holdToken['tokenId'] . PHP_EOL;

// UPDATE — update the expiration date of an existing saved token
$updatedCard = $client->tokens->update(
    'existing-token-id',  // The tokenId you stored earlier
    '06/2027',            // New expiration date in MM/YYYY format
    '123456799'           // Cardholder document number (optional)
);
echo 'Updated expiry, token still valid: ' . $updatedCard['tokenId'] . PHP_EOL;

// DELETE (REMOVE) — permanently delete a saved token
$client->tokens->delete(
    'existing-token-id',           // The tokenId to remove
    'david.caballero@ecollect.co', // Cardholder's email
    '123456799'                    // Cardholder's document number
);
echo 'Card token deleted.' . PHP_EOL;
```

---

## 7. Listing Saved Tokens

To show a customer their saved payment methods (e.g., on a checkout page), call `queryToken`:

```php
<?php

require_once __DIR__ . '/vendor/autoload.php';

use Ecollect\EcollectClient;

$client = new EcollectClient([
    'api_key'     => 'YOUR_API_KEY_HERE',
    'ety_code'    => 50039,
    'environment' => 'test',
]);

// List all saved cards for a specific customer
// Both the email and document number are required for security
$savedCards = $client->tokens->list(
    'david.caballero@ecollect.co', // Customer's email
    '123456799'                     // Customer's document number
);

if (empty($savedCards)) {
    echo 'This customer has no saved cards.' . PHP_EOL;
} else {
    echo 'Found ' . count($savedCards) . ' saved card(s):' . PHP_EOL;

    foreach ($savedCards as $card) {
        echo '---' . PHP_EOL;
        echo 'Token ID: ' . $card['tokenId'] . PHP_EOL;           // Use this for payments
        echo 'Masked card: ' . ($card['maskedCard'] ?? '') . PHP_EOL; // Show to customer
        echo 'Last 4: ' . ($card['last4'] ?? '') . PHP_EOL;
        echo 'Bank: ' . ($card['fiName'] ?? '') . PHP_EOL;
        echo 'Status: ' . ($card['tokenStatus'] ?? '') . PHP_EOL; // ACTIVE | VERIFY | EXPIRED
        echo 'Requires OTP: ' . ($card['requiresOneTimePassword'] ? 'Yes' : 'No') . PHP_EOL;
    }
}
```

---

## 8. Processing a Payment

### 8.1 Payment with a new card (hosted checkout)

This creates a hosted checkout URL that you redirect the user to. ecollect handles the card form.

```php
<?php

require_once __DIR__ . '/vendor/autoload.php';

use Ecollect\EcollectClient;
use Ecollect\Types\PaymentIntent;
use Ecollect\Types\Customer;

$client = new EcollectClient([
    'api_key'     => 'YOUR_API_KEY_HERE',
    'ety_code'    => 50039,
    'environment' => 'test',
    'srv_code'    => 1001, // Your default service code
]);

// Build the customer object
$customer = new Customer(
    'David Caballero',     // Full name
    'david.caballero@ecollect.co', // Email
    '+1 311111111',        // Phone
    'CC',                  // Document type (CC = Colombian national ID)
    '123456799'            // Document number
);

// Build the payment intent
$intent = new PaymentIntent(
    50000,       // 💰 Amount (50,000 Colombian pesos)
    'COP',       // 💱 Currency (ISO 4217: COP, MXN, DOP, USD)
    $customer    // 👤 Customer information
);

// Set optional fields
$intent->vatAmount            = 7983;                        // Tax/VAT portion
$intent->merchantTransactionId = 'ORDER-2024-001';           // Your unique order ID
$intent->redirectUrl          = 'https://yoursite.com/payment/success'; // After payment
$intent->responseUrl          = 'https://yoursite.com/webhooks/ecollect'; // Webhook URL
$intent->langCode             = 'ES';                        // Language: ES or EN

// Process the payment
$result = $client->payments->process($intent);

echo 'Return code: ' . $result['returnCode'] . PHP_EOL;   // 'SUCCESS'
echo 'Ticket ID: ' . $result['ticketId'] . PHP_EOL;       // Save this in your database!

// For hosted checkout, redirect the user to this URL
if (!empty($result['eCollectUrl'])) {
    echo 'Redirect user to: ' . $result['eCollectUrl'] . PHP_EOL;
    // header('Location: ' . $result['eCollectUrl']);
    // exit;
}
```

### 8.2 Payment with a saved card token (one-click checkout)

Once you have a `tokenId` from step 6, you can charge the card directly.

```php
<?php

// Build the intent with token information
$intentWithToken = new PaymentIntent(50000, 'COP', $customer);
$intentWithToken->merchantTransactionId = 'ORDER-2024-002'; // Must be unique!

// 🪙 The tokenId from tokens->save() or tokens->list()
$intentWithToken->tokenId      = 'the-token-id-you-saved-earlier';

// Payment system and FI code associated with the saved card
$intentWithToken->paymentSystem = '1';
$intentWithToken->fiCode        = '190';

// 🔒 CVV (required for most tokenized card payments)
$intentWithToken->secureCode    = '123';

// Optional: number of installments
$intentWithToken->installments  = 1;

$result = $client->payments->process($intentWithToken);
echo 'Payment status: ' . ($result['tranState'] ?? '') . PHP_EOL; // 'OK' = approved!
echo 'Trazability code: ' . ($result['trazabilityCode'] ?? '') . PHP_EOL;
```

### 8.3 Pre-authorization and capture

Pre-authorization reserves funds on the card without charging. Useful for hotels, car rentals, etc.

```php
<?php

// Step 1: Pre-authorize (reserve funds)
$preAuthResult = $client->payments->preAuthorize($intent);
$ticketId = $preAuthResult['ticketId'];
echo 'Funds reserved. Ticket ID: ' . $ticketId . PHP_EOL;

// Step 2: Later, capture the actual charge
$captureResult = $client->payments->capture($ticketId, 45000.0); // Charge 45,000 instead of 50,000
echo 'Charged! State: ' . ($captureResult['tranState'] ?? '') . PHP_EOL;

// Or cancel the reservation (void) without charging
$client->payments->void($ticketId);
echo 'Reservation cancelled, customer not charged.' . PHP_EOL;
```

### Understanding the result array fields

| Key | Description |
|---|---|
| `returnCode` | `'SUCCESS'` if the API call succeeded (does not mean the payment is approved!) |
| `ticketId` | ecollect's unique transaction ID — **save this in your database** |
| `tranState` | Payment outcome: `'OK'` = approved, `'NOT_AUTHORIZED'` = declined |
| `trazabilityCode` | Bank's reference number for reconciliation |
| `transValue` | Final charged amount |
| `bankProcessDate` | Date/time the bank processed the transaction |
| `eCollectUrl` | URL to redirect the user to for hosted checkout |

---

## 9. Getting Available Payment Systems

Display the available payment methods for your country/entity to the user:

```php
<?php

require_once __DIR__ . '/vendor/autoload.php';

use Ecollect\EcollectClient;

$client = new EcollectClient([
    'api_key'     => 'YOUR_API_KEY_HERE',
    'ety_code'    => 50039,
    'environment' => 'test',
]);

// Get the list of payment systems configured for your entity
$paymentSystems = $client->paymentSystems->list();

foreach ($paymentSystems as $ps) {
    echo 'Payment system code: ' . $ps['paymentSystem'] . PHP_EOL;
    // paymentSystem codes:
    //   '0'   = PSE (Colombian bank transfers)
    //   '1'   = Credit/debit cards (Colombia)
    //   '7'   = SPEI (Mexican bank transfers)
    //   '10'  = Payment link
    //   '100' = Cash payment

    echo 'Brand image: ' . ($ps['brandImageUrl'] ?? '(none)') . PHP_EOL;

    // For card systems, list available banks
    if (!empty($ps['financialInstitutions'])) {
        foreach ($ps['financialInstitutions'] as $fi) {
            echo '  Bank: ' . $fi['fiName'] . ' (code: ' . $fi['fiCode'] . ')' . PHP_EOL;
        }
    }
}
```

---

## 10. Checking Transaction Status

After a payment, you can query its current state at any time using the `ticketId`:

```php
<?php

require_once __DIR__ . '/vendor/autoload.php';

use Ecollect\EcollectClient;

$client = new EcollectClient([
    'api_key'     => 'YOUR_API_KEY_HERE',
    'ety_code'    => 50039,
    'environment' => 'test',
]);

// Query a specific transaction by ticketId
$status = $client->reconciliation->getTransactionStatus(987654);

echo 'Transaction state: ' . ($status['tranState'] ?? '') . PHP_EOL;
// Possible states:
//   'OK'             — Payment approved and settled ✅
//   'NOT_AUTHORIZED' — Bank declined the payment ❌
//   'PENDING'        — Still processing (e.g., PSE bank transfer in progress)
//   'BANK'           — Sent to bank, awaiting confirmation
//   'CAPTURED'       — Pre-auth was captured
//   'CREATED'        — Transaction created but not yet processed
//   'EXPIRED'        — Transaction expired without being paid
//   'FAILED'         — Technical failure

echo 'Amount charged: ' . ($status['transValue'] ?? '') . PHP_EOL;
echo 'Currency: ' . ($status['payCurrency'] ?? '') . PHP_EOL;
echo 'Bank reference: ' . ($status['trazabilityCode'] ?? '') . PHP_EOL;

// You can also include your merchantTransactionId for cross-reference
$statusByOrderId = $client->reconciliation->getTransactionStatus(
    987654,
    'ORDER-2024-001' // Your merchantTransactionId
);
```

### Automatic polling (wait for final state)

For async payment methods like PSE or SPEI, the payment may take a few minutes. The SDK can poll automatically:

```php
<?php

use Ecollect\Exceptions\PollingTimeoutException;

try {
    // Wait up to 10 minutes for the transaction to reach a final state
    $finalResult = $client->reconciliation->reconciliate(
        987654,  // ticketId
        600000   // timeout in milliseconds (10 minutes)
    );

    if ($finalResult['tranState'] === 'OK') {
        echo 'Payment completed successfully!' . PHP_EOL;
    } else {
        echo 'Payment did not complete: ' . $finalResult['tranState'] . PHP_EOL;
    }
} catch (PollingTimeoutException $e) {
    echo 'Timed out waiting. Check status manually later.' . PHP_EOL;
}
```

---

## 11. Webhook Signature Verification

When a payment completes (or fails), ecollect sends a POST request to your `responseUrl`. You must verify that the request is genuinely from ecollect before trusting it.

### Setting up a webhook endpoint

```php
<?php
// File: webhooks/ecollect.php

require_once __DIR__ . '/../vendor/autoload.php';

use Ecollect\EcollectClient;
use Ecollect\Exceptions\WebhookValidationException;

// Parse the incoming JSON body
$rawBody  = file_get_contents('php://input');
$payload  = json_decode($rawBody, true);

if ($payload === null) {
    http_response_code(400);
    echo json_encode(['ReturnCode' => 'FAIL_SYSTEM']);
    exit;
}

$client = new EcollectClient([
    'api_key'     => 'YOUR_API_KEY_HERE',
    'ety_code'    => 50039,
    'environment' => 'test',
]);

try {
    // Verify the webhook is genuine by calling ecollect's verifySessionToken API.
    // This checks that the SessionToken in the payload belongs to your entity.
    $sessionToken = $client->session->getActive();
    $result       = $client->webhooks->confirmWebhook($payload, $sessionToken);

    echo 'Webhook verified! State: ' . ($result['tranState'] ?? '') . PHP_EOL;

    // Update your database based on the transaction state
    if (($result['tranState'] ?? '') === 'OK') {
        // Mark the order as paid
        markOrderAsPaid($result['ticketId'], $result['trazabilityCode']);
    }

    // IMPORTANT: You must respond with this exact JSON or ecollect will retry the webhook
    header('Content-Type: application/json');
    echo json_encode(['ReturnCode' => 'SUCCESS']);

} catch (WebhookValidationException $e) {
    // The webhook payload is invalid or could be a forgery attempt
    error_log('Invalid webhook: ' . $e->getMessage());
    http_response_code(400);
    header('Content-Type: application/json');
    echo json_encode(['ReturnCode' => 'FAIL_SYSTEM']);
}
```

### HMAC signature verification (optional additional layer)

If ecollect also sends an HMAC signature header, you can verify it:

```php
<?php

// Get the signature from the request headers
$signature = $_SERVER['HTTP_X_ECOLLECT_SIG'] ?? '';

// Verify the HMAC-SHA256 signature
$isValid = $client->webhooks->verifyWebhookSignature(
    $payload,             // The parsed JSON payload array
    $signature,           // The signature header value
    'YOUR_WEBHOOK_SECRET' // Your webhook secret from the dashboard
);

if (!$isValid) {
    http_response_code(401);
    echo 'Invalid signature';
    exit;
}
```

---

## 12. Error Handling

Every SDK error extends `EcollectException`, which extends PHP's standard `RuntimeException`. You can use normal `try/catch` blocks and check the specific exception class.

```php
<?php

use Ecollect\Exceptions\EcollectException;
use Ecollect\Exceptions\InvalidCardException;
use Ecollect\Exceptions\InvalidConfigException;
use Ecollect\Exceptions\ValidationException;
use Ecollect\Exceptions\SessionExpiredException;
use Ecollect\Exceptions\NetworkRetryableException;
use Ecollect\Exceptions\TokenNotFoundException;
use Ecollect\Exceptions\DuplicateTransactionException;
use Ecollect\Exceptions\AuthenticationException;
use Ecollect\Exceptions\WebhookValidationException;
use Ecollect\Exceptions\CustomerException;
use Ecollect\Exceptions\PollingTimeoutException;

try {
    $result = $client->payments->process($intent);
    // Handle success...

} catch (InvalidCardException $e) {
    // The card number failed Luhn validation, or the expiration date is wrong
    echo 'Card is invalid: ' . $e->getMessage() . PHP_EOL;
    // Tell the user to check their card number and expiry date

} catch (ValidationException $e) {
    // A required field is missing or has an invalid value
    echo 'Validation error: ' . $e->getMessage() . PHP_EOL;
    // Check the message for the specific field that is wrong

} catch (DuplicateTransactionException $e) {
    // merchantTransactionId was already used in another transaction
    echo 'Duplicate order ID — generate a new merchantTransactionId' . PHP_EOL;

} catch (TokenNotFoundException $e) {
    // The tokenId provided does not exist or was already deleted
    echo 'Saved card not found — ask customer to re-enter card' . PHP_EOL;

} catch (SessionExpiredException $e) {
    // This should rarely happen because the SDK retries automatically
    echo 'Session expired unexpectedly' . PHP_EOL;

} catch (NetworkRetryableException $e) {
    // A temporary server-side error. The SDK already retried max_retries times.
    echo 'ecollect is temporarily unavailable. Try again later.' . PHP_EOL;

} catch (AuthenticationException $e) {
    // Your API key or entity code is wrong, or the merchant is blocked
    echo 'Authentication failed — check your api_key and ety_code' . PHP_EOL;

} catch (WebhookValidationException $e) {
    // Webhook payload is forged or invalid
    echo 'Invalid webhook: ' . $e->getMessage() . PHP_EOL;

} catch (CustomerException $e) {
    // Customer-related error (not found, mismatch, etc.)
    echo 'Customer error: ' . $e->getMessage() . PHP_EOL;

} catch (PollingTimeoutException $e) {
    // reconciliate() timed out waiting for a final state
    echo 'Polling timed out for ticket: ' . $e->getTicketId() . PHP_EOL;

} catch (InvalidConfigException $e) {
    // You passed wrong values to EcollectClient constructor
    echo 'SDK misconfigured: ' . $e->getMessage() . PHP_EOL;

} catch (EcollectException $e) {
    // Any other ecollect-specific error not caught above
    echo 'ecollect error [' . $e->getCode() . ']: ' . $e->getMessage() . PHP_EOL;
    echo 'Raw return code: ' . $e->getReturnCode() . PHP_EOL;

} catch (\Exception $e) {
    // A genuine unexpected error (network outage, bug, etc.)
    throw $e; // Re-throw so your global error handler sees it
}
```

### Exception class reference

| Class | When it's thrown |
|---|---|
| `EcollectException` | Base class for all SDK exceptions |
| `InvalidConfigException` | Wrong constructor arguments |
| `SessionExpiredException` | Token expired (usually auto-recovered) |
| `ValidationException` | Missing/invalid field in your request |
| `InvalidCardException` | Bad card number or expiration date |
| `NetworkRetryableException` | Temporary server error, retries exhausted |
| `TokenNotFoundException` | Token ID does not exist |
| `DuplicateTransactionException` | `merchantTransactionId` already used |
| `AuthenticationException` | API key/entity code invalid or blocked |
| `WebhookValidationException` | Webhook payload is forged or invalid |
| `CustomerException` | Customer-related errors |
| `PollingTimeoutException` | `reconciliate()` timed out |

---

## 13. Test vs Production

### Test environment

```php
<?php

$client = new EcollectClient([
    'api_key'     => 'YOUR_TEST_API_KEY',
    'ety_code'    => 50039,     // Test entity code
    'environment' => 'test',   // Uses https://test1.e-collect.com/app_express/api/
]);
```

- **Does NOT charge real money**
- Test card: `4296005885355275`, expiry `12/2025`, any CVV
- Test cardholder: David Caballero, CC 123456799, FiCode 190

### Production environment

```php
<?php

$client = new EcollectClient([
    'api_key'     => 'YOUR_PRODUCTION_API_KEY',  // Different key from test!
    'ety_code'    => 12345,                       // Your real merchant entity code
    'environment' => 'prod',                      // Uses https://www.e-collect.com/app_Express/api/
]);
```

> ⚠️ **Never hardcode production credentials in your source code.** Use environment variables:

```php
<?php

// Load from environment variables (set in your server configuration or .env file)
$client = new EcollectClient([
    'api_key'     => getenv('ECOLLECT_API_KEY'),
    'ety_code'    => (int) getenv('ECOLLECT_ETY_CODE'),
    'environment' => getenv('ECOLLECT_ENV') ?: 'test',
]);
```

Example `.env` file (add to `.gitignore` — never commit this!):

```
ECOLLECT_API_KEY=your-secret-api-key
ECOLLECT_ETY_CODE=50039
ECOLLECT_ENV=test
```

If you use a `.env` loader like [vlucas/phpdotenv](https://github.com/vlucas/phpdotenv):

```bash
composer require vlucas/phpdotenv
```

```php
<?php

$dotenv = Dotenv\Dotenv::createImmutable(__DIR__);
$dotenv->load();

$client = new EcollectClient([
    'api_key'     => $_ENV['ECOLLECT_API_KEY'],
    'ety_code'    => (int) $_ENV['ECOLLECT_ETY_CODE'],
    'environment' => $_ENV['ECOLLECT_ENV'] ?? 'test',
]);
```

> 📌 Note: in production, `getTransactionInformation` automatically uses `https://m.e-collect.com/app_Express/api/GetTransactionInformation` — the SDK handles this URL switch for you.

---

## 14. Full End-to-End Example

This is a complete, runnable PHP script that covers: setup → save a card → pay with the saved card → check the transaction status.

```php
<?php
/**
 * ecollect PHP SDK — complete end-to-end example
 *
 * Run: php example.php
 */

require_once __DIR__ . '/vendor/autoload.php';

use Ecollect\EcollectClient;
use Ecollect\Types\PaymentIntent;
use Ecollect\Types\Customer;
use Ecollect\Exceptions\EcollectException;
use Ecollect\Exceptions\InvalidCardException;
use Ecollect\Exceptions\ValidationException;

// ─── 1. Initialize the client ─────────────────────────────────────────────
$client = new EcollectClient([
    'api_key'     => 'YOUR_TEST_API_KEY',   // From the ecollect merchant dashboard
    'ety_code'    => 50039,                  // Your test entity code
    'environment' => 'test',                 // Test environment — no real money charged
    'srv_code'    => 1001,                   // Your default service code
    'log_level'   => 'info',
]);

try {
    // ─── 2. Save a card token ────────────────────────────────────────────────
    echo PHP_EOL . '📦 Saving card token...' . PHP_EOL;

    $cardData = [
        'cardNumber'       => '4296005885355275',  // Test Visa card
        'expirationDate'   => '12/2025',            // MM/YYYY format
        'secureCode'       => '123',                // CVV
        'cardHolderName'   => 'David Caballero',
        'cardHolderIdType' => 'CC',                 // CC = Colombian national ID
        'cardHolderId'     => '123456799',
        'paymentSystem'    => '1',                  // Visa Colombia
        'fiCode'           => '190',                // Test financial institution
        'email'            => 'david.caballero@ecollect.co',
    ];

    $savedCard = $client->tokens->save($cardData);
    echo '✅ Card saved!' . PHP_EOL;
    echo '   Token ID: ' . $savedCard['tokenId'] . PHP_EOL;    // Store in your DB!
    echo '   Masked: ' . ($savedCard['maskedCard'] ?? '') . PHP_EOL;

    // ─── 3. List saved cards ─────────────────────────────────────────────────
    echo PHP_EOL . '📋 Listing saved cards...' . PHP_EOL;
    $cards = $client->tokens->list(
        'david.caballero@ecollect.co',
        '123456799'
    );
    echo '✅ Found ' . count($cards) . ' saved card(s).' . PHP_EOL;

    // ─── 4. Process a payment with the saved token ───────────────────────────
    echo PHP_EOL . '💳 Processing payment...' . PHP_EOL;

    // Build the customer object
    $customer = new Customer(
        'David Caballero',
        'david.caballero@ecollect.co',
        '+1 311111111',
        'CC',
        '123456799'
    );

    // Build the payment intent
    $intent = new PaymentIntent(50000, 'COP', $customer);
    $intent->vatAmount             = 7983;
    $intent->merchantTransactionId = 'ORDER-' . time(); // Must be unique!
    $intent->tokenId               = $savedCard['tokenId']; // Use the saved token
    $intent->paymentSystem         = '1';
    $intent->fiCode                = '190';
    $intent->secureCode            = '123';
    $intent->installments          = 1;
    $intent->responseUrl           = 'https://yoursite.com/webhooks/ecollect';

    $result = $client->payments->process($intent);
    echo '✅ Payment processed!' . PHP_EOL;
    echo '   Ticket ID: ' . ($result['ticketId'] ?? '') . PHP_EOL;  // Store in your DB!
    echo '   State: ' . ($result['tranState'] ?? '') . PHP_EOL;      // 'OK' = approved
    echo '   Trazability: ' . ($result['trazabilityCode'] ?? '') . PHP_EOL;

    // ─── 5. Check transaction status ─────────────────────────────────────────
    if (!empty($result['ticketId'])) {
        echo PHP_EOL . '🔍 Checking transaction status...' . PHP_EOL;
        $status = $client->reconciliation->getTransactionStatus((int)$result['ticketId']);
        echo '   Final state: ' . ($status['tranState'] ?? '') . PHP_EOL;
        echo '   Amount charged: ' . ($status['transValue'] ?? '') . ' ' . ($status['payCurrency'] ?? '') . PHP_EOL;
        echo '   Bank date: ' . ($status['bankProcessDate'] ?? '') . PHP_EOL;
    }

    // ─── 6. Get available payment systems ────────────────────────────────────
    echo PHP_EOL . '🏦 Available payment systems:' . PHP_EOL;
    $paymentSystems = $client->paymentSystems->list();
    foreach ($paymentSystems as $ps) {
        echo '  - ' . $ps['paymentSystem'] . ' → ' . ($ps['brandImageUrl'] ?? '(no image)') . PHP_EOL;
    }

    echo PHP_EOL . '🎉 All done!' . PHP_EOL;

} catch (InvalidCardException $e) {
    echo '❌ Invalid card: ' . $e->getMessage() . PHP_EOL;
    exit(1);
} catch (ValidationException $e) {
    echo '❌ Validation error: ' . $e->getMessage() . PHP_EOL;
    exit(1);
} catch (EcollectException $e) {
    echo '❌ ecollect error: ' . $e->getMessage() . PHP_EOL;
    echo '   Return code: ' . $e->getReturnCode() . PHP_EOL;
    exit(1);
} catch (\Exception $e) {
    echo '❌ Unexpected error: ' . $e->getMessage() . PHP_EOL;
    exit(1);
}
```

---

## 15. Common Errors

### "api_key is required"

**Cause:** You passed an empty string or forgot `api_key` in the options array.

```php
// ❌ Wrong
$client = new EcollectClient(['api_key' => '', 'ety_code' => 50039, 'environment' => 'test']);

// ✅ Correct
$client = new EcollectClient(['api_key' => 'my-real-api-key', 'ety_code' => 50039, 'environment' => 'test']);
```

### "ety_code must be a positive integer"

**Cause:** You passed `0`, `null`, or a non-numeric string.

```php
// ❌ Wrong
$client = new EcollectClient(['api_key' => 'key', 'ety_code' => 0, 'environment' => 'test']);

// ✅ Correct
$client = new EcollectClient(['api_key' => 'key', 'ety_code' => 50039, 'environment' => 'test']);
```

### "srvCode is required"

**Cause:** You didn't set `srv_code` in the constructor options or `srvCode` in `PaymentIntent`.

```php
// ✅ Option 1: set it in the constructor (applies to all payments)
$client = new EcollectClient([..., 'srv_code' => 1001]);

// ✅ Option 2: set it per payment
$intent->srvCode = 1001;
```

### "Card number is invalid (Luhn check failed)"

**Cause:** The card number doesn't pass the Luhn algorithm. This is checked locally before any HTTP call.

```php
// Use the test card number:
'cardNumber' => '4296005885355275'
```

### `FAIL_INVALIDENTITYCODE`

**Cause:** Your `ety_code` is wrong or doesn't exist in the chosen environment.

**Fix:** Double-check the entity code in your ecollect merchant dashboard. Test and production environments use different codes.

### `FAIL_ACCESSDENIED`

**Cause:** Your API key is wrong, has been revoked, or your merchant account is inactive.

**Fix:** Log into the ecollect dashboard, regenerate your API key, and update your configuration.

### `FAIL_MERCHANTRANSID`

**Cause:** You used the same `merchantTransactionId` twice.

**Fix:** Generate a unique ID for every transaction. Using `time()` is a simple option; for high-volume systems use `uniqid('ORDER-', true)` or a UUID library.

---

## 16. Frequently Asked Questions

**Q: Do I need to call `getSessionToken` myself?**

No. The SDK calls it automatically before the first API request and refreshes it transparently when it expires. You never need to manage session tokens manually.

---

**Q: Where do I get my API key and entity code?**

Log into your ecollect merchant dashboard and navigate to **API Credentials**. Your `api_key` and `ety_code` are displayed there. If you don't have dashboard access, contact your ecollect account representative.

---

**Q: Will the test environment charge my card?**

No. The test environment (`'environment' => 'test'`) is a complete sandbox and **never charges any card**. Use it freely during development.

---

**Q: Can I use the SDK in a shared hosting environment?**

Yes, as long as PHP 7.4+ is available and Composer can install packages. The only runtime dependency is Guzzle HTTP, which works on any standard PHP hosting.

---

**Q: What is a service code (`srv_code`)?**

A service code identifies a specific payment service configured for your merchant account (e.g., a particular currency, payment method, or settlement period). You get this value from ecollect when they configure your account. Most merchants have one default service code.

---

**Q: What is a financial institution code (`fiCode`)?**

For card payments, this identifies the card-acquiring bank. For PSE/SPEI bank transfers, it identifies the customer's bank. The full list of valid codes for your entity comes from `$client->paymentSystems->list()`.

---

**Q: What happens if the network goes down mid-payment?**

The SDK retries `max_retries` times (default: 3) with exponential back-off. If all retries fail, a `NetworkRetryableException` is thrown. Always check the transaction status via `getTransactionStatus($ticketId)` before retrying a payment — the original payment may have gone through despite the network error.

---

**Q: What is `merchantTransactionId` and must it be unique?**

It is your internal order/reference ID. ecollect stores it alongside the transaction so you can find it later by your own ID. It **must be unique per transaction** — if you reuse one, you will get a `DuplicateTransactionException`.

---

**Q: How do I handle PSE (Colombian bank transfer) payments?**

PSE payments are asynchronous — the customer is redirected to their bank's website. The flow is:

1. Call `$client->payments->process($intent)` with `paymentSystem = '0'` (PSE) and a `redirectUrl`.
2. Redirect the user to `$result['eCollectUrl']`.
3. ecollect sends a webhook to your `responseUrl` when the bank confirms (or denies) the transfer.
4. Alternatively, poll with `$client->reconciliation->reconciliate($ticketId)`.

---

**Q: My webhook is getting called multiple times. Why?**

If your webhook endpoint doesn't respond with `{"ReturnCode":"SUCCESS"}` within a few seconds, ecollect will retry the notification. Make sure you always return that JSON response at the end of your webhook handler, even if you defer the actual processing to a background job.

---

*For further help, visit [https://www.e-collect.com](https://www.e-collect.com) or contact the ecollect support team.*
