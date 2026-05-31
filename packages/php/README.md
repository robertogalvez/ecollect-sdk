# ecollect PHP SDK

![PHP 7.4+](https://img.shields.io/badge/PHP-7.4%2B-777BB4?logo=php) ![Composer](https://img.shields.io/badge/Composer-required-885630?logo=composer) ![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)

---

## 📖 What is this SDK?

The **ecollect PHP SDK** is the official client library for integrating the ecollect LatAm payment gateway into any PHP application. It supports Colombia, Mexico, and the Dominican Republic, and handles session management, card tokenization, payments, and transaction reconciliation automatically — letting you go from zero to live payments with just a few lines of PHP.

---

## ✅ Prerequisites

Before you begin, make sure you have:

- **PHP 7.4 or higher** (PHP 8.x is fully supported and recommended)
- **Composer** installed globally — [Get Composer](https://getcomposer.org/)
- The `curl` and `json` PHP extensions enabled (on by default in most environments)
- An ecollect account with a valid **API Key** and **EntityCode** (provided by ecollect when you sign up)

---

## 📦 Installation

```bash
composer require ecollect/sdk
```

After installation, make sure your project includes Composer's autoloader:

```php
<?php
require_once __DIR__ . '/vendor/autoload.php';
```

---

## ⚙️ Initial Setup

Create a client instance once and reuse it. In a framework like Laravel you would bind it in a service provider; in plain PHP just include a shared bootstrap file:

```php
<?php
use Ecollect\EcollectClient;

$client = new EcollectClient([
    // ─────────────────────────────────────────────────────────────────────
    // REQUIRED — Your API key from the ecollect merchant dashboard
    'api_key'     => 'YOUR_API_KEY_HERE',

    // REQUIRED — Your entity code, assigned by ecollect (e.g. "50039")
    'entity_code' => 'YOUR_ENTITY_CODE',

    // OPTIONAL — Set to true to use the TEST/sandbox environment.
    // Always use sandbox mode during development! Default: false
    'sandbox'     => true,

    // OPTIONAL — Request timeout in seconds. Default: 30
    'timeout'     => 30,

    // OPTIONAL — Number of automatic retries on network failure. Default: 2
    'retries'     => 2,

    // OPTIONAL — Enable verbose debug output (logs to error_log). Default: false
    'debug'       => false,
]);
```

---

## 🔑 How Sessions Work

ecollect uses a two-layer authentication model:

1. **API Key + EntityCode** — your static credentials, never exposed to end users.
2. **SessionToken** — a short-lived token the SDK fetches automatically before each request.

**You do not need to manage session tokens yourself.** The SDK caches the token in memory and refreshes it transparently when it expires.

If you need the raw token value (e.g. to pass to a front-end widget):

```php
<?php
$tokenInfo = $client->getSessionToken();

echo 'SessionToken: ' . $tokenInfo->sessionToken . PHP_EOL;
echo 'Expires at  : ' . $tokenInfo->expiresAt . PHP_EOL; // ISO 8601 string
```

---

## 💳 Save a Card Token

Tokenizing a card stores it securely on ecollect's PCI-compliant servers and returns a **token** you use for future payments without ever handling raw card numbers:

```php
<?php
use Ecollect\Enums\TokenCommandAction;

$result = $client->tokenCommand([
    // ── Action ────────────────────────────────────────────────────────────
    // TokenCommandAction::SAVE   → store a new card, returns a token
    // TokenCommandAction::GET    → retrieve card info by token
    // TokenCommandAction::REMOVE → permanently delete a token
    // TokenCommandAction::UPDATE → update card details (e.g. new expiry date)
    // TokenCommandAction::HOLD   → temporarily freeze a token
    'action'              => TokenCommandAction::SAVE,

    // ── Card details ──────────────────────────────────────────────────────
    'card_number'         => '4296005885355275', // Full PAN — TEST card number
    'expiration_date'     => '12/2025',           // Must be MM/YYYY
    'payment_system'      => '1',                 // 1 = Visa, 2 = Mastercard

    // ── Card holder identity ──────────────────────────────────────────────
    'card_holder_name'    => 'David Caballero',   // Exactly as on the physical card
    'card_holder_id_type' => 'CC',                // CC = Colombian cédula | CE | NIT | PP
    'card_holder_id'      => '123456799',          // Government-issued ID number

    // ── Contact information ───────────────────────────────────────────────
    'email'               => 'david.caballero@ecollect.co',
    'mobile_country_code' => '1',     // Dialing code without "+" (Colombia = 57)
    'mobile_number'       => '311111111',

    // ── Financial institution ─────────────────────────────────────────────
    // fi_code identifies the issuing bank/network. Use 190 in test environment.
    'fi_code'             => '190',

    // ── CVV ───────────────────────────────────────────────────────────────
    // Required when your merchant risk settings demand it. NEVER store this value!
    'cvv'                 => '123',
]);

// Save $result->token in your database to use for future payments
echo 'Token saved: ' . $result->token . PHP_EOL;
```

---

## 🔍 Query Saved Tokens

Retrieve all cards saved for a specific cardholder — useful for a "pick your saved card" screen:

```php
<?php
$cards = $client->queryToken([
    // Search by email address...
    'email' => 'david.caballero@ecollect.co',

    // ...OR search by document type + number:
    // 'card_holder_id_type' => 'CC',
    // 'card_holder_id'      => '123456799',
]);

foreach ($cards as $card) {
    echo sprintf(
        "Token: %s | Brand: %s | Last4: %s | Expires: %s\n",
        $card->token,
        $card->paymentSystem,
        $card->lastFour,
        $card->expirationDate
    );
}
```

---

## 💰 Process a Payment

### Pay with a saved token (recommended)

```php
<?php
$payment = $client->createTransactionPayment([
    // ── Amount ────────────────────────────────────────────────────────────
    'amount'              => 50000,    // Smallest currency unit
                                        // COP: centavos | MXN: centavos | DOP: centavos
    'currency'            => 'COP',    // ISO 4217: 'COP' | 'MXN' | 'DOP'

    // ── Saved token ───────────────────────────────────────────────────────
    'token'               => 'SAVED_TOKEN_HERE',

    // ── Order identification (must be unique per transaction!) ─────────────
    'order_id'            => 'ORDER-' . time(),
    'description'         => 'Monthly subscription plan A',

    // ── Cardholder (must match what was used when saving the token) ────────
    'card_holder_name'    => 'David Caballero',
    'card_holder_id_type' => 'CC',
    'card_holder_id'      => '123456799',
    'email'               => 'david.caballero@ecollect.co',
    'mobile_country_code' => '1',
    'mobile_number'       => '311111111',

    // ── CVV re-entry (optional) ────────────────────────────────────────────
    'cvv'                 => '123',
]);

if ($payment->approved) {
    echo '✅ Payment approved!' . PHP_EOL;
    echo '   Reference: ' . $payment->transactionReference . PHP_EOL; // Save for reconciliation
    echo '   Auth code: ' . $payment->authorizationCode . PHP_EOL;
} else {
    echo '❌ Payment declined: ' . $payment->responseMessage . PHP_EOL;
}
```

### Pay without a token (one-shot card entry)

```php
<?php
$payment = $client->createTransactionPayment([
    'amount'              => 50000,
    'currency'            => 'COP',
    'order_id'            => 'ORDER-' . time(),
    'description'         => 'One-time purchase',

    // Full card details (no token needed)
    'card_number'         => '4296005885355275',
    'expiration_date'     => '12/2025',
    'payment_system'      => '1',
    'cvv'                 => '123',
    'fi_code'             => '190',

    'card_holder_name'    => 'David Caballero',
    'card_holder_id_type' => 'CC',
    'card_holder_id'      => '123456799',
    'email'               => 'david.caballero@ecollect.co',
    'mobile_country_code' => '1',
    'mobile_number'       => '311111111',
]);
```

---

## 🏦 Get Available Payment Systems

```php
<?php
$methods = $client->getPaymentSystem();

foreach ($methods as $method) {
    // id     → paymentSystem code for tokenCommand / createTransactionPayment
    // name   → human-readable name: "Visa", "Mastercard", "PSE", "SPEI", etc.
    // active → bool: whether this method is currently enabled
    printf("[%s] %s — active: %s\n", $method->id, $method->name, $method->active ? 'yes' : 'no');
}
```

---

## 🔄 Check Transaction Status

Verify the final status of any transaction for reconciliation:

```php
<?php
$info = $client->getTransactionInformation([
    'transaction_reference' => 'YOUR_TRANSACTION_REFERENCE',
]);

echo 'Status    : ' . $info->status . PHP_EOL;          // APPROVED | REJECTED | PENDING
echo 'Amount    : ' . $info->amount . PHP_EOL;
echo 'Currency  : ' . $info->currency . PHP_EOL;
echo 'Date      : ' . $info->transactionDate . PHP_EOL; // ISO 8601
echo 'Auth code : ' . $info->authorizationCode . PHP_EOL;
```

> In production, this method automatically calls the special endpoint
> `https://m.e-collect.com/app_Express/api/GetTransactionInformation`.
> The SDK switches URLs based on the `sandbox` flag — no changes needed in your code.

---

## 🔔 Webhook Verification (HMAC-SHA256)

When ecollect sends an asynchronous notification to your server, always verify the signature first:

```php
<?php
use Ecollect\Exceptions\WebhookVerificationException;

// Read the raw POST body BEFORE calling json_decode() or any input filter
$rawBody   = file_get_contents('php://input');
$signature = $_SERVER['HTTP_X_ECOLLECT_SIGNATURE'] ?? '';

try {
    // verifySessionToken validates the HMAC-SHA256 signature from ecollect
    // and returns a decoded stdClass payload if valid
    $payload = $client->verifySessionToken($rawBody, $signature);

    echo '✅ Webhook verified. Event type: ' . $payload->eventType . PHP_EOL;
    echo '   Transaction ref: ' . $payload->transactionReference . PHP_EOL;

    // Update your order in the database
    // if ($payload->status === 'APPROVED') { markOrderPaid($payload->orderId); }

    http_response_code(200);
    echo json_encode(['received' => true]);

} catch (WebhookVerificationException $e) {
    // Invalid signature — reject the request immediately
    http_response_code(400);
    echo 'Invalid signature';
}
```

---

## ⚠️ Error Handling

All exceptions extend `Ecollect\Exceptions\EcollectException`:

```php
<?php
use Ecollect\Exceptions\EcollectException;         // Base — catches any SDK error
use Ecollect\Exceptions\AuthenticationException;   // Thrown when: API key/EntityCode wrong or expired
use Ecollect\Exceptions\ValidationException;       // Thrown when: required field missing or malformed
use Ecollect\Exceptions\PaymentDeclinedException;  // Thrown when: card issuer rejected the transaction
use Ecollect\Exceptions\NetworkException;          // Thrown when: timeout or connection failure
use Ecollect\Exceptions\TokenNotFoundException;    // Thrown when: token does not exist
use Ecollect\Exceptions\RateLimitException;        // Thrown when: too many requests in short window
use Ecollect\Exceptions\ServerException;           // Thrown when: unexpected 5xx from ecollect

try {
    $payment = $client->createTransactionPayment([/* ... */]);

} catch (AuthenticationException $e) {
    // ➡ Re-check api_key and entity_code. Sandbox vs production mismatch?
    error_log('Bad credentials: ' . $e->getMessage());

} catch (ValidationException $e) {
    // ➡ getFields() returns [['field' => '...', 'message' => '...'], ...]
    error_log('Validation error: ' . json_encode($e->getFields()));

} catch (PaymentDeclinedException $e) {
    // ➡ Do NOT retry automatically. Show a user-friendly message.
    error_log('Declined: ' . $e->getResponseCode() . ' — ' . $e->getResponseMessage());

} catch (NetworkException $e) {
    // ➡ Safe to retry after a brief delay
    error_log('Network error: ' . $e->getMessage());

} catch (TokenNotFoundException $e) {
    // ➡ Token was removed or never existed — ask user to re-enter the card
    error_log('Token not found');

} catch (RateLimitException $e) {
    // ➡ Implement exponential back-off; getRetryAfter() gives seconds to wait
    error_log('Rate limited. Retry after: ' . $e->getRetryAfter() . 's');

} catch (ServerException $e) {
    // ➡ Log details and contact ecollect support
    error_log('Server error ' . $e->getStatusCode() . ': ' . $e->getRawBody());

} catch (EcollectException $e) {
    error_log('Unexpected SDK error: ' . $e->getMessage());
}
```

---

## 🌍 Test vs Production

| Setting | Test (Sandbox) | Production |
|---|---|---|
| `sandbox` option | `true` | `false` |
| Base URL | `https://test1.e-collect.com/app_express/api/` | `https://www.e-collect.com/app_Express/api/` |
| GetTransactionInformation URL | same base URL | `https://m.e-collect.com/app_Express/api/GetTransactionInformation` |
| Test card | `4296005885355275` | Real cards only |
| EntityCode example | `50039` | Your production EntityCode |
| Real money charged? | ❌ No | ✅ Yes |

---

## 📋 Complete End-to-End PHP Script

```php
<?php
require_once __DIR__ . '/vendor/autoload.php';

use Ecollect\EcollectClient;
use Ecollect\Enums\TokenCommandAction;
use Ecollect\Exceptions\EcollectException;
use Ecollect\Exceptions\PaymentDeclinedException;
use Ecollect\Exceptions\ValidationException;

// ── 1. Create the client in sandbox mode ──────────────────────────────────────
$client = new EcollectClient([
    'api_key'     => 'YOUR_API_KEY',  // Replace with your real test API key
    'entity_code' => '50039',          // Replace with your real entity code
    'sandbox'     => true,             // TEST environment
    'debug'       => true,             // Helpful logs during development
]);

try {
    // ── 2. List available payment methods ──────────────────────────────────
    echo "\n🏦 Available payment methods:\n";
    $methods = $client->getPaymentSystem();
    foreach ($methods as $m) {
        echo "  [{$m->id}] {$m->name} — active: " . ($m->active ? 'yes' : 'no') . "\n";
    }

    // ── 3. Save a card token ───────────────────────────────────────────────
    echo "\n💳 Saving card...\n";
    $tokenResult = $client->tokenCommand([
        'action'              => TokenCommandAction::SAVE,
        'card_number'         => '4296005885355275',
        'expiration_date'     => '12/2025',
        'payment_system'      => '1',
        'cvv'                 => '123',
        'card_holder_name'    => 'David Caballero',
        'card_holder_id_type' => 'CC',
        'card_holder_id'      => '123456799',
        'email'               => 'david.caballero@ecollect.co',
        'mobile_country_code' => '1',
        'mobile_number'       => '311111111',
        'fi_code'             => '190',
    ]);
    $token = $tokenResult->token;
    echo "  Token: $token\n";

    // ── 4. List saved tokens for this cardholder ───────────────────────────
    echo "\n🔍 Querying saved tokens...\n";
    $cards = $client->queryToken(['email' => 'david.caballero@ecollect.co']);
    foreach ($cards as $card) {
        echo "  {$card->token} — {$card->lastFour} ({$card->paymentSystem})\n";
    }

    // ── 5. Create a payment with the saved token ───────────────────────────
    echo "\n💰 Creating payment...\n";
    $payment = $client->createTransactionPayment([
        'amount'              => 50000,
        'currency'            => 'COP',
        'token'               => $token,
        'order_id'            => 'ORDER-' . time(),
        'description'         => 'Test purchase via ecollect PHP SDK',
        'card_holder_name'    => 'David Caballero',
        'card_holder_id_type' => 'CC',
        'card_holder_id'      => '123456799',
        'email'               => 'david.caballero@ecollect.co',
        'mobile_country_code' => '1',
        'mobile_number'       => '311111111',
    ]);

    if ($payment->approved) {
        echo "  ✅ Approved! Ref: {$payment->transactionReference}\n";

        // ── 6. Check the transaction status ────────────────────────────────
        echo "\n🔄 Verifying status...\n";
        $info = $client->getTransactionInformation([
            'transaction_reference' => $payment->transactionReference,
        ]);
        echo "  Status: {$info->status} | Date: {$info->transactionDate}\n";
    } else {
        echo "  ❌ Declined: {$payment->responseMessage}\n";
    }

    // ── 7. Clean up — remove the test token ───────────────────────────────
    echo "\n🗑️  Removing token...\n";
    $client->tokenCommand(['action' => TokenCommandAction::REMOVE, 'token' => $token]);
    echo "  Done.\n";

} catch (ValidationException $e) {
    echo "\n🚨 Validation error: " . json_encode($e->getFields()) . "\n";
} catch (PaymentDeclinedException $e) {
    echo "\n🚨 Payment declined: {$e->getResponseMessage()}\n";
} catch (EcollectException $e) {
    echo "\n🚨 SDK error: {$e->getMessage()}\n";
}
```

---

## ❓ FAQ

**Q1: Does the SDK require Guzzle?**
No. The SDK uses PHP's native cURL extension by default. You can optionally pass a PSR-18 HTTP client (like Guzzle) via the `http_client` option if your project already uses one.

**Q2: How do I use this in Laravel?**
Bind `EcollectClient` in a service provider and inject it through the IoC container. Store your `api_key` and `entity_code` in `.env` and read them with `env('ECOLLECT_API_KEY')`. Never commit credentials to version control.

**Q3: Can I save multiple cards per customer?**
Yes. Each `tokenCommand(SAVE)` call returns a unique token. Store all tokens in your database associated with the customer record.

**Q4: Is the CVV stored by ecollect?**
No. ecollect never persists CVV values. Pass it during save/payment and discard it immediately — do not store it anywhere.

**Q5: What happens when the session token expires?**
The SDK automatically detects a 401 response, fetches a new session token, and retries the request once. Fully transparent to your code.

**Q6: Does this work with PHP 8.x?**
Yes. PHP 8.0, 8.1, 8.2, and 8.3 are all tested and supported.

**Q7: Can I use this in a WordPress plugin?**
Yes. Include Composer's autoloader in your plugin bootstrap, then use `EcollectClient` normally. Make sure not to conflict with other plugins' Composer dependencies by using a package prefix or an isolated vendor directory.

---

## 🐛 Common Errors and Fixes

| Error | Likely Cause | Fix |
|---|---|---|
| `AuthenticationException: Invalid API key` | Wrong credentials or environment mismatch | Check `api_key` and `entity_code`; ensure sandbox/production keys match the `sandbox` setting |
| `ValidationException: card_number is required` | Missing required field | Verify all fields are present in your array |
| `ValidationException: expiration_date format` | Wrong date format | Use `MM/YYYY` exactly, e.g. `12/2025` |
| `PaymentDeclinedException: CARD_DECLINED` | Card issuer rejected the charge | Show a friendly message; do not auto-retry |
| `NetworkException: cURL error 7` | No internet access or wrong environment | Check `sandbox` flag; verify server can reach ecollect |
| `TokenNotFoundException` | Token was deleted or never created | Call `tokenCommand(SAVE)` again to create a new token |
| `RateLimitException` | Too many API calls per minute | Add delays / exponential back-off; contact ecollect to raise limits |
| `ServerException: 503` | ecollect temporarily down | Retry after 30–60 s; check ecollect status page |
| `Call to undefined method` | Old SDK version | Run `composer update ecollect/sdk` |
| PHP `cURL extension not found` | Extension disabled | Enable `extension=curl` in `php.ini` and restart PHP-FPM |
