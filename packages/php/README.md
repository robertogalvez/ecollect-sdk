# ecollect PHP SDK

PHP SDK for the ecollect LatAm payment gateway. Supports Colombia, Mexico, and Dominican Republic.

## Requirements

- PHP >= 7.4
- Composer

## Installation

```bash
composer require ecollect/sdk
```

## Quick Start

```php
use Ecollect\EcollectClient;
use Ecollect\Types\Customer;
use Ecollect\Types\PaymentIntent;

$client = new EcollectClient([
    'api_key'     => 'your-api-key',
    'ety_code'    => 123,
    'environment' => 'test', // 'test' | 'prod'
    'srv_code'    => 456,    // optional default
]);

// Create session token
$token = $client->session->create();

// Process a payment (hosted checkout)
$customer = new Customer([
    'email'     => 'customer@example.com',
    'full_name' => 'Juan Perez',
]);

$intent = new PaymentIntent([
    'amount'       => 100.00,
    'currency'     => 'COP',
    'customer'     => $customer,
    'redirect_url' => 'https://mystore.com/confirmation',
]);

$result = $client->payments->hostedCheckout($intent);
// Redirect user to $result['eCollectUrl']
```

## Modules

- `$client->session` — Session token management (auto-refresh)
- `$client->payments` — process, preAuthorize, capture, void, hostedCheckout
- `$client->tokens` — save, get, hold, delete, update, list (tokenisation)
- `$client->webhooks` — verifyWebhookSignature, confirmWebhook
- `$client->reconciliation` — getTransactionStatus, reconciliate (polling)
- `$client->customers` — getOrCreateCustomerId, updateCustomerInfo
- `$client->paymentSystems` — getPaymentSystems
- `$client->paymentLinks` — generatePaymentLink (email|sms|qr)

## Running Tests

```bash
composer install
./vendor/bin/phpunit
```

## Plugins

- `plugins/woocommerce/` — WooCommerce payment gateway plugin
- `plugins/prestashop/` — PrestaShop payment module
