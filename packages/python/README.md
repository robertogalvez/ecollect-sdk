# ecollect Python SDK

Python SDK for the [ecollect](https://www.e-collect.com/) LatAm payment gateway.

## Installation

```bash
pip install ecollect-sdk
```

## Quick start

```python
from ecollect import EcollectClient, Customer, PaymentIntent

client = EcollectClient(
    api_key="your-api-key",
    ety_code=123,
    environment="test",  # "test" | "prod"
    srv_code=456,        # optional default service code
)

customer = Customer(
    email="user@example.com",
    full_name="Juan Pérez",
    document_type="CC",
    document_number="12345678",
    phone="3001234567",
)

intent = PaymentIntent(
    amount=50000.0,
    currency="COP",
    customer=customer,
    merchant_transaction_id="order-001",
)

# Async
import asyncio
result = asyncio.run(client.payments.process(intent))

# Sync
result = client.payments.process_sync(intent)
print(result["TicketId"])
```

## Modules

| Module | Methods |
|--------|---------|
| `client.session` | `create()`, `get_active()` |
| `client.payments` | `process()`, `pre_authorize()`, `capture()`, `void_payment()`, `hosted_checkout()` |
| `client.tokens` | `save()`, `get_temporary()`, `hold()`, `list_saved()`, `delete()`, `update()` |
| `client.webhooks` | `verify_webhook_signature()`, `confirm_webhook()` |
| `client.reconciliation` | `get_transaction_status()`, `reconciliate()` |
| `client.customers` | `get_or_create_customer_id()`, `update_customer_info()` |
| `client.payment_systems` | `get_payment_systems()` |
| `client.payment_links` | `generate_payment_link(intent, method='email'|'sms'|'qr')` |

All async methods have a `_sync` variant (e.g. `process_sync()`).

## Environments

| Environment | Base URL |
|-------------|----------|
| `test` | `https://test1.e-collect.com/app_express/api/` |
| `prod` | `https://www.e-collect.com/app_Express/api/` |

## Error handling

```python
from ecollect import (
    SessionExpiredError,
    InvalidCardError,
    DuplicateTransactionError,
    NetworkRetryableError,
)

try:
    result = await client.payments.process(intent)
except InvalidCardError:
    print("Invalid card number")
except DuplicateTransactionError:
    print("Transaction ID already used")
except NetworkRetryableError:
    print("System error — SDK already retried 3 times")
```

## Development

```bash
pip install -e ".[dev]"
python -m pytest -v
```
