# 🚀 ecollect Python SDK — Complete Guide

Welcome to the **ecollect Python SDK**! This guide is written for developers of all experience levels. If you have never integrated a payment gateway before, don't worry — we explain every single step.

---

## 📋 Table of Contents

1. [What is ecollect?](#what-is-ecollect)
2. [Prerequisites](#prerequisites)
3. [Installation](#installation)
4. [Setup — Creating the Client](#setup--creating-the-client)
5. [Async vs Sync API](#async-vs-sync-api)
6. [Getting a Session Token](#getting-a-session-token)
7. [Saving a Card Token](#saving-a-card-token)
8. [Listing Saved Tokens](#listing-saved-tokens)
9. [Processing a Payment](#processing-a-payment)
10. [Getting Available Payment Systems](#getting-available-payment-systems)
11. [Checking Transaction Status](#checking-transaction-status)
12. [Webhook Signature Verification](#webhook-signature-verification)
13. [Error Handling](#error-handling)
14. [Test vs Production](#test-vs-production)
15. [Full Working Script (End-to-End)](#full-working-script-end-to-end)
16. [Common Errors](#common-errors)
17. [FAQ](#faq)

---

## 💡 What is ecollect?

**ecollect** is a Latin American payment gateway that allows your application to:

- Accept credit and debit card payments (Visa, Mastercard, and more)
- Process bank transfers (PSE in Colombia, SPEI in Mexico, and others)
- Save card information securely using **tokens** (so customers don't have to type their card number every time)
- Check the status of past transactions
- Verify webhooks sent by ecollect to your server

The SDK (Software Development Kit) is a Python library that wraps all of ecollect's API calls into easy-to-use Python functions — you don't need to write raw HTTP requests yourself.

> 🏦 **Where do I get my credentials?** Your **API Key** and **Entity Code** come from the ecollect merchant dashboard. Contact your ecollect account manager to get access.

---

## ✅ Prerequisites

Before you start, make sure you have:

| Requirement | Minimum Version | How to check |
|---|---|---|
| Python | 3.9 or higher | `python --version` |
| pip | Latest recommended | `pip --version` |

### Installing Python (if you don't have it)

Go to [https://www.python.org/downloads/](https://www.python.org/downloads/) and download the installer for your operating system. During installation, check the box that says **"Add Python to PATH"**.

### Verifying your Python version

Open your terminal (Command Prompt on Windows, Terminal on Mac/Linux) and type:

```bash
python --version
# Expected output example: Python 3.11.4
```

If you see `Python 2.x.x`, you need to install Python 3. Try `python3 --version` on Mac/Linux.

---

## 📦 Installation

Install the ecollect SDK using pip:

```bash
pip install ecollect-sdk
```

If you are using a virtual environment (recommended!):

```bash
# Create a virtual environment named "venv"
python -m venv venv

# Activate it on Mac/Linux
source venv/bin/activate

# Activate it on Windows (Command Prompt)
venv\Scripts\activate

# Now install the SDK inside the virtual environment
pip install ecollect-sdk
```

> 💡 **What is a virtual environment?** It is an isolated Python environment for your project. It keeps your project's dependencies separate from other projects on your machine. Think of it as a dedicated toolbox for each project.

Verify the installation worked:

```bash
pip show ecollect-sdk
# Should display: Name: ecollect-sdk, Version: x.x.x, etc.
```

---

## 🔧 Setup — Creating the Client

The `EcollectClient` is the main object you use to talk to the ecollect API. You create it once and reuse it throughout your application.

```python
from ecollect import EcollectClient

# Create the client with your credentials
client = EcollectClient(
    api_key="YOUR_API_KEY_HERE",        # The API key from your ecollect dashboard
    entity_code="YOUR_ENTITY_CODE",     # Your entity code (e.g., "50039")
    test_mode=True,                     # True  = test environment (no real charges!)
                                        # False = production (real money!)
)
```

### All available options

```python
from ecollect import EcollectClient

client = EcollectClient(
    api_key="YOUR_API_KEY_HERE",        # Required: your API key
    entity_code="YOUR_ENTITY_CODE",     # Required: your entity code
    test_mode=True,                     # Optional: defaults to False (production)
    timeout=30,                         # Optional: HTTP timeout in seconds (default: 30)
    retries=3,                          # Optional: number of retries on failure (default: 3)
)
```

### Test vs Production URLs

The SDK automatically selects the correct URL based on `test_mode`:

| Mode | URL |
|---|---|
| Test (`test_mode=True`) | `https://test1.e-collect.com/app_express/api/` |
| Production (`test_mode=False`) | `https://www.e-collect.com/app_Express/api/` |
| Production — Transaction Info | `https://m.e-collect.com/app_Express/api/GetTransactionInformation` |

> ⚠️ **Important:** The test environment does **NOT** charge real money. Always use `test_mode=True` during development and testing. Never use real card numbers in test mode.

---

## ⚡ Async vs Sync API

The ecollect SDK supports both **synchronous** and **asynchronous** programming styles.

### What is async/sync?

- **Synchronous (sync)**: Your code waits for each operation to finish before moving to the next line. Simple and easy to understand — great for scripts and simple applications.
- **Asynchronous (async)**: Your code can do other work while waiting for a network request to come back. Better for performance in web servers that handle many users simultaneously.

### Synchronous example

```python
# Synchronous code — runs line by line, waits at each step
from ecollect import EcollectClient

client = EcollectClient(api_key="YOUR_KEY", entity_code="50039", test_mode=True)

# This line WAITS until the response comes back
token = client.get_session_token()
print(token.session_token)
```

### Asynchronous example

```python
# Asynchronous code — requires the asyncio library
import asyncio
from ecollect import EcollectClient

client = EcollectClient(api_key="YOUR_KEY", entity_code="50039", test_mode=True)

async def main():
    # 'await' means: wait for this, but allow other tasks to run in the meantime
    token = await client.async_get_session_token()
    print(token.session_token)

# asyncio.run() starts the async event loop and runs your async function
asyncio.run(main())
```

> 💡 **Which should I use?** Use **sync** if you are writing a script, using Django, or using Flask with regular (non-async) views. Use **async** if you are using FastAPI, aiohttp, or any other async web framework. Both produce exactly the same results.

---

## 🔑 Getting a Session Token

Before making most API calls, you need a **session token**. Think of it as a temporary password that proves you are allowed to make requests. Session tokens expire after a short time, so always get a fresh one before important operations.

### Synchronous

```python
from ecollect import EcollectClient

# Initialize the client (do this once, usually at app startup)
client = EcollectClient(
    api_key="YOUR_API_KEY",
    entity_code="50039",
    test_mode=True,
)

# Request a session token from the ecollect API
response = client.get_session_token()

# The response object contains the token and metadata
print("Session token:", response.session_token)
print("Expires at:", response.expires_at)
print("Status:", response.status)
```

### Asynchronous

```python
import asyncio
from ecollect import EcollectClient

client = EcollectClient(
    api_key="YOUR_API_KEY",
    entity_code="50039",
    test_mode=True,
)

async def get_token():
    # Notice the 'async_' prefix on async method names
    response = await client.async_get_session_token()
    print("Session token:", response.session_token)
    print("Expires at:", response.expires_at)

asyncio.run(get_token())
```

### Response fields

| Field | Type | Description |
|---|---|---|
| `session_token` | `str` | The token string to use in subsequent requests |
| `expires_at` | `datetime` | When this token expires (get a new one before then) |
| `status` | `str` | `"SUCCESS"` if everything worked |

---

## 💳 Saving a Card Token

Card **tokenization** allows you to save a customer's card details securely. Instead of storing the raw card number in your database (which requires strict PCI DSS compliance), ecollect stores it and gives you a **token** — a safe reference you can store and use for future payments.

### The `token_command` method with `SAVE`

#### Asynchronous version (recommended for web apps)

```python
import asyncio
from ecollect import EcollectClient
from ecollect.models import TokenCommandRequest

client = EcollectClient(
    api_key="YOUR_API_KEY",
    entity_code="50039",
    test_mode=True,
)

async def save_card():
    # Step 1: Get a session token — required before any API call
    session = await client.async_get_session_token()
    session_token = session.session_token

    # Step 2: Build the request object with the card details
    request = TokenCommandRequest(
        command="SAVE",                          # Tell ecollect we want to SAVE a new card
        session_token=session_token,             # The session token we just got
        card_number="4296005885355275",          # The customer's card number
        expiration_date="12/2025",               # Card expiry date (format: MM/YYYY)
        payment_system=1,                        # Payment network: 1 = Visa
        fi_code=190,                             # Financial institution code
        cardholder_name="David Caballero",       # Name exactly as printed on the card
        cardholder_id_type="CC",                 # ID type: CC = Colombian Cédula
        cardholder_id="123456799",               # The cardholder's national ID number
        email="david.caballero@ecollect.co",     # Customer email (for receipts)
        phone="+1 311111111",                    # Customer phone number
    )

    # Step 3: Send the request to ecollect
    response = await client.async_token_command(request)

    # Step 4: Store response.token in YOUR database — you'll need it for payments
    print("Card saved successfully!")
    print("Token to store in your DB:", response.token)
    print("Status:", response.status)

asyncio.run(save_card())
```

#### Synchronous version

```python
from ecollect import EcollectClient
from ecollect.models import TokenCommandRequest

client = EcollectClient(
    api_key="YOUR_API_KEY",
    entity_code="50039",
    test_mode=True,
)

# Step 1: Get a session token
session = client.get_session_token()
session_token = session.session_token

# Step 2: Build the save card request
request = TokenCommandRequest(
    command="SAVE",                          # Command: SAVE a new card
    session_token=session_token,             # Required: active session token
    card_number="4296005885355275",          # The customer's card number (no spaces/dashes)
    expiration_date="12/2025",               # Expiry date: MM/YYYY
    payment_system=1,                        # 1 = Visa, 2 = Mastercard, etc.
    fi_code=190,                             # Financial institution code from ecollect
    cardholder_name="David Caballero",       # Name as it appears on the card
    cardholder_id_type="CC",                 # CC = Cédula Ciudadana (Colombia)
    cardholder_id="123456799",               # Customer's national ID number
    email="david.caballero@ecollect.co",     # Email (used for receipt and notifications)
    phone="+1 311111111",                    # Phone with country code
)

# Step 3: Execute the command
response = client.token_command(request)

# Step 4: Save response.token in your database!
# This token represents the card — use it for future payments
print("Card saved successfully!")
print("Token to store:", response.token)
print("Status:", response.status)
```

### Other token commands

| Command | Description |
|---|---|
| `SAVE` | Save a new card and receive a reusable token |
| `GET` | Retrieve card details (masked) using a token |
| `REMOVE` | Delete a saved card token permanently |
| `UPDATE` | Update card details (e.g., new expiry date) |
| `HOLD` | Temporarily freeze a card token |

#### GET — Retrieve a saved card

```python
from ecollect.models import TokenCommandRequest

# Retrieve information about a saved card (card number will be masked)
request = TokenCommandRequest(
    command="GET",
    session_token=session_token,  # Your active session token
    token="CARD_TOKEN_HERE",      # The token you saved when the card was stored
)

response = client.token_command(request)
print("Cardholder:", response.cardholder_name)
print("Last 4 digits:", response.last_four)         # e.g., "5275"
print("Expires:", response.expiration_date)
```

#### REMOVE — Delete a saved card

```python
from ecollect.models import TokenCommandRequest

# Permanently delete a saved card (customer requested deletion, for example)
request = TokenCommandRequest(
    command="REMOVE",
    session_token=session_token,  # Your active session token
    token="CARD_TOKEN_HERE",      # The token of the card to delete
)

response = client.token_command(request)
print("Card removed, status:", response.status)
```

---

## 📋 Listing Saved Tokens

Use `query_token` to get all cards saved for a specific customer. This is useful to build a "Saved payment methods" screen in your app.

### Synchronous

```python
from ecollect import EcollectClient
from ecollect.models import QueryTokenRequest

client = EcollectClient(
    api_key="YOUR_API_KEY",
    entity_code="50039",
    test_mode=True,
)

# Get a session token first (always required)
session = client.get_session_token()

# Build the query — we identify the customer by their ID
request = QueryTokenRequest(
    session_token=session.session_token,  # Active session token
    cardholder_id="123456799",            # The customer's national ID
    cardholder_id_type="CC",              # ID type (CC, NIT, Passport, etc.)
)

# Execute the query
response = client.query_token(request)

# Loop through the results and display each card
print(f"Found {len(response.tokens)} saved card(s) for this customer:")
for card in response.tokens:
    print(f"  Token: {card.token}")
    print(f"  Card:  **** **** **** {card.last_four}")
    print(f"  Type:  {card.payment_system_name}")   # e.g., "Visa"
    print(f"  Exp:   {card.expiration_date}")
    print()
```

### Asynchronous

```python
import asyncio
from ecollect import EcollectClient
from ecollect.models import QueryTokenRequest

client = EcollectClient(
    api_key="YOUR_API_KEY",
    entity_code="50039",
    test_mode=True,
)

async def list_saved_cards(customer_id: str):
    # Get a fresh session token
    session = await client.async_get_session_token()

    request = QueryTokenRequest(
        session_token=session.session_token,
        cardholder_id=customer_id,
        cardholder_id_type="CC",
    )

    response = await client.async_query_token(request)

    # Return a list of card summaries your UI can display
    return [
        {
            "token": card.token,
            "last_four": card.last_four,
            "type": card.payment_system_name,
            "expires": card.expiration_date,
        }
        for card in response.tokens
    ]

cards = asyncio.run(list_saved_cards("123456799"))
print(cards)
```

---

## 💰 Processing a Payment

The `create_transaction_payment` method charges a customer. You can pay using:
1. A **card token** (saved previously — recommended for returning customers)
2. **Card details directly** (for one-time payments where the card is not saved)

### Payment with a saved token (Synchronous)

```python
from ecollect import EcollectClient
from ecollect.models import CreateTransactionPaymentRequest

client = EcollectClient(
    api_key="YOUR_API_KEY",
    entity_code="50039",
    test_mode=True,
)

# Step 1: Get a fresh session token
session = client.get_session_token()

# Step 2: Build the payment request
request = CreateTransactionPaymentRequest(
    session_token=session.session_token,    # Active session token
    amount=50000,                           # Amount in the smallest currency unit
                                            # (e.g., 50000 cents = $500.00 COP)
    currency="COP",                         # Currency: COP, MXN, PEN, etc.
    order_id="ORDER-001",                   # YOUR unique reference for this order
    description="Purchase at My Store",    # Human-readable description
    token="CARD_TOKEN_HERE",               # Token from a previously saved card
    cardholder_id="123456799",             # Customer's national ID
    cardholder_id_type="CC",              # ID type
    email="david.caballero@ecollect.co",  # Customer email (for receipt)
    phone="+1 311111111",                 # Customer phone
    ip_address="192.168.1.1",             # Customer's IP address
)

# Step 3: Execute the payment
response = client.create_transaction_payment(request)

# Step 4: Check whether the payment was approved
if response.approved:
    print("✅ Payment approved!")
    print("Transaction ID:", response.transaction_id)     # Save this!
    print("Authorization code:", response.authorization_code)
else:
    print("❌ Payment declined.")
    print("Reason:", response.response_message)
    print("Code:", response.response_code)
```

### Payment with card details directly (no token)

```python
from ecollect import EcollectClient
from ecollect.models import CreateTransactionPaymentRequest

client = EcollectClient(
    api_key="YOUR_API_KEY",
    entity_code="50039",
    test_mode=True,
)

session = client.get_session_token()

# Use raw card details instead of a token (card is NOT saved for future use)
request = CreateTransactionPaymentRequest(
    session_token=session.session_token,
    amount=50000,
    currency="COP",
    order_id="ORDER-002",
    description="One-time purchase",
    # --- Card details (use these OR a token, not both) ---
    card_number="4296005885355275",        # Full card number
    expiration_date="12/2025",             # Expiry date MM/YYYY
    payment_system=1,                      # 1 = Visa
    fi_code=190,                           # Financial institution code
    cardholder_name="David Caballero",     # Name on the card
    cardholder_id="123456799",
    cardholder_id_type="CC",
    email="david.caballero@ecollect.co",
    phone="+1 311111111",
    ip_address="192.168.1.1",
)

response = client.create_transaction_payment(request)
print("Approved:", response.approved)
print("Transaction ID:", response.transaction_id)
```

### Payment response fields

| Field | Type | Description |
|---|---|---|
| `approved` | `bool` | `True` if payment was approved |
| `transaction_id` | `str` | Unique ID — **save this in your database!** |
| `authorization_code` | `str` | Bank authorization code |
| `response_message` | `str` | Human-readable result message |
| `response_code` | `str` | Machine-readable result code |
| `amount` | `int` | Amount charged |

---

## 🏦 Getting Available Payment Systems

Use `get_payment_system` to list all payment methods enabled for your account (Visa, Mastercard, PSE, SPEI, etc.). Use this to populate a payment method selector in your checkout UI.

```python
from ecollect import EcollectClient
from ecollect.models import GetPaymentSystemRequest

client = EcollectClient(
    api_key="YOUR_API_KEY",
    entity_code="50039",
    test_mode=True,
)

# Get a session token
session = client.get_session_token()

# Build the request — just needs the session token
request = GetPaymentSystemRequest(
    session_token=session.session_token,
)

# Execute and display results
response = client.get_payment_system(request)

print("Available payment methods for your account:")
for method in response.payment_systems:
    print(f"  ID: {method.payment_system_id:<5} Name: {method.name}")
    # Example output:
    # ID: 1     Name: Visa
    # ID: 2     Name: Mastercard
    # ID: 5     Name: PSE
    # ID: 10    Name: SPEI
```

---

## 🔍 Checking Transaction Status

Use `get_transaction_information` to look up the current status of any transaction. This is essential for:
- **Reconciliation**: Matching your records with ecollect's records at end of day
- **Timeout recovery**: If your server crashed mid-payment, check if it was approved
- **Customer support**: Quickly look up a transaction when a customer calls

> 📌 **Note:** In production, this endpoint uses a special URL (`https://m.e-collect.com/app_Express/api/GetTransactionInformation`). The SDK handles this automatically — you don't need to do anything.

```python
from ecollect import EcollectClient
from ecollect.models import GetTransactionInformationRequest

client = EcollectClient(
    api_key="YOUR_API_KEY",
    entity_code="50039",
    test_mode=True,
)

# Get a session token
session = client.get_session_token()

# Build the status inquiry request
request = GetTransactionInformationRequest(
    session_token=session.session_token,      # Active session token
    transaction_id="TRANSACTION_ID_HERE",     # The ID returned when the payment was created
)

# Execute the inquiry
response = client.get_transaction_information(request)

# Display the current transaction information
print("Transaction ID:", response.transaction_id)
print("Status:", response.status)             # "APPROVED", "DECLINED", "PENDING", etc.
print("Amount:", response.amount)
print("Currency:", response.currency)
print("Date:", response.transaction_date)
print("Authorization:", response.authorization_code)
print("Customer:", response.cardholder_name)
```

---

## 🔒 Webhook Signature Verification

When a payment is completed, ecollect sends a **webhook** — an HTTP POST request to a URL you configure in your merchant dashboard. This notifies your server about payment events in real time.

To confirm that a webhook truly came from ecollect (and not from an attacker), always **verify the signature** using `verify_session_token`.

### Setting up a webhook endpoint (Flask example)

```python
from flask import Flask, request, jsonify
from ecollect import EcollectClient

app = Flask(__name__)

# Initialize the client once at startup
client = EcollectClient(
    api_key="YOUR_API_KEY",
    entity_code="50039",
    test_mode=True,
)

@app.route("/webhook/ecollect", methods=["POST"])
def ecollect_webhook():
    # Parse the incoming JSON payload
    data = request.get_json()

    if not data:
        return jsonify({"error": "No data received"}), 400

    # ecollect includes a session_token in the webhook payload
    session_token = data.get("session_token")

    if not session_token:
        return jsonify({"error": "Missing session token"}), 400

    # Verify the token — this confirms the request is genuinely from ecollect
    is_valid = client.verify_session_token(session_token)

    if not is_valid:
        # Reject — this could be a spoofed/fake webhook attempt
        return jsonify({"error": "Invalid session token"}), 401

    # The webhook is genuine — process it
    transaction_id = data.get("transaction_id")
    status = data.get("status")

    if status == "APPROVED":
        # Update your order status in your database
        print(f"Payment {transaction_id} was approved — fulfil the order!")
    elif status == "DECLINED":
        print(f"Payment {transaction_id} was declined.")

    # Always return 200 so ecollect knows you received the webhook
    return jsonify({"received": True}), 200


if __name__ == "__main__":
    app.run(port=5000)
```

### Standalone verification

```python
from ecollect import EcollectClient

client = EcollectClient(
    api_key="YOUR_API_KEY",
    entity_code="50039",
    test_mode=True,
)

# The token you extracted from the incoming webhook payload
incoming_token = "TOKEN_FROM_WEBHOOK_PAYLOAD"

# Returns True if authentic, False if invalid/expired
is_valid = client.verify_session_token(incoming_token)

if is_valid:
    print("✅ Webhook is authentic — safe to process")
else:
    print("❌ Webhook failed verification — reject it!")
```

---

## ❌ Error Handling

The SDK raises specific exception types so you can handle each error scenario appropriately.

### All exception classes

| Exception | When it is raised |
|---|---|
| `EcollectAuthError` | Invalid API key or entity code |
| `EcollectConnectionError` | Cannot reach the ecollect server (network issue) |
| `EcollectTimeoutError` | Request took longer than the configured timeout |
| `EcollectValidationError` | Invalid or missing parameters in your request |
| `EcollectApiError` | ecollect returned a business-logic error (e.g., card declined) |
| `EcollectError` | Base class — catches any of the above |

### Example: Comprehensive error handling

```python
from ecollect import EcollectClient
from ecollect.models import CreateTransactionPaymentRequest
from ecollect.exceptions import (
    EcollectAuthError,        # Wrong credentials
    EcollectConnectionError,  # Network problem — can't reach server
    EcollectTimeoutError,     # Took too long to respond
    EcollectValidationError,  # Bad input data sent in request
    EcollectApiError,         # API responded with a business error
    EcollectError,            # Catch-all for any ecollect error
)

client = EcollectClient(
    api_key="YOUR_API_KEY",
    entity_code="50039",
    test_mode=True,
)

try:
    # Attempt to get a session and process a payment
    session = client.get_session_token()

    request = CreateTransactionPaymentRequest(
        session_token=session.session_token,
        amount=50000,
        currency="COP",
        order_id="ORDER-003",
        description="Test payment",
        token="CARD_TOKEN_HERE",
        cardholder_id="123456799",
        cardholder_id_type="CC",
        email="customer@example.com",
        phone="+1 311111111",
        ip_address="192.168.1.1",
    )

    response = client.create_transaction_payment(request)
    print("Result:", response.response_message)

except EcollectAuthError as e:
    # Your API key or entity code is wrong
    print(f"Authentication failed: {e}")
    print("Action: Log in to your ecollect dashboard and copy the API key again.")

except EcollectConnectionError as e:
    # Could not reach the ecollect server
    print(f"Connection error: {e}")
    print("Action: Check your internet connection. Try again in a moment.")

except EcollectTimeoutError as e:
    # The server did not respond in time
    print(f"Request timed out: {e}")
    print("Action: The server may be busy. Retry, or increase the timeout setting.")
    # Consider checking transaction status before retrying to avoid double charges!

except EcollectValidationError as e:
    # You sent invalid or missing data
    print(f"Validation error: {e}")
    print(f"Field with problem: {e.field}")
    print("Action: Check all required fields in your request.")

except EcollectApiError as e:
    # ecollect processed the request but returned a business error
    print(f"API error: {e}")
    print(f"Error code: {e.code}")
    print(f"Error message: {e.message}")

except EcollectError as e:
    # Something else went wrong with the ecollect SDK
    print(f"Unexpected ecollect error: {e}")

except Exception as e:
    # Non-ecollect errors (bugs in your code, etc.)
    print(f"Unexpected error: {e}")
    raise
```

---

## 🌍 Test vs Production

### Using the test environment

```python
# TEST MODE — safe sandbox, no real money moved
client = EcollectClient(
    api_key="YOUR_TEST_API_KEY",
    entity_code="50039",
    test_mode=True,   # <-- Activates test environment
)
```

### Switching to production

```python
# PRODUCTION MODE — real transactions with real money!
client = EcollectClient(
    api_key="YOUR_PRODUCTION_API_KEY",      # PRODUCTION API key from dashboard
    entity_code="YOUR_PRODUCTION_ENTITY",   # PRODUCTION entity code
    test_mode=False,                        # <-- Activates live environment
)
```

### Best practice: Use environment variables

Never hardcode credentials in your source code! Anyone who reads your code (or your git history) could steal them. Use environment variables:

```python
import os
from ecollect import EcollectClient

client = EcollectClient(
    api_key=os.environ["ECOLLECT_API_KEY"],          # Read from environment
    entity_code=os.environ["ECOLLECT_ENTITY_CODE"],  # Read from environment
    test_mode=os.environ.get("ECOLLECT_TEST_MODE", "true").lower() == "true",
)
```

Set the environment variables before running your app:

```bash
# Mac/Linux (add to ~/.bashrc or ~/.zshrc for persistence)
export ECOLLECT_API_KEY="your_api_key_here"
export ECOLLECT_ENTITY_CODE="50039"
export ECOLLECT_TEST_MODE="true"

# Windows (Command Prompt)
set ECOLLECT_API_KEY=your_api_key_here
set ECOLLECT_ENTITY_CODE=50039
set ECOLLECT_TEST_MODE=true
```

Or use a `.env` file with the `python-dotenv` package:

```bash
# Install python-dotenv
pip install python-dotenv
```

```
# .env file (NEVER commit this file to git!)
ECOLLECT_API_KEY=your_api_key_here
ECOLLECT_ENTITY_CODE=50039
ECOLLECT_TEST_MODE=true
```

```python
from dotenv import load_dotenv
import os
from ecollect import EcollectClient

load_dotenv()  # Loads variables from .env file

client = EcollectClient(
    api_key=os.environ["ECOLLECT_API_KEY"],
    entity_code=os.environ["ECOLLECT_ENTITY_CODE"],
    test_mode=os.environ.get("ECOLLECT_TEST_MODE", "true").lower() == "true",
)
```

### Test card data

Use these details when `test_mode=True` to simulate payments:

| Field | Test Value |
|---|---|
| Card Number | `4296005885355275` |
| Expiration Date | `12/2025` |
| Payment System | `1` (Visa) |
| FI Code | `190` |
| Cardholder Name | `David Caballero` |
| Cardholder ID Type | `CC` |
| Cardholder ID | `123456799` |
| Email | `david.caballero@ecollect.co` |
| Phone | `+1 311111111` |
| Entity Code | `50039` |

---

## 🎯 Full Working Script (End-to-End)

This script demonstrates the complete payment flow. Copy it, replace the credentials, and run it with `python example.py`.

```python
"""
ecollect SDK — Full End-to-End Example (Synchronous)

This script demonstrates the complete flow:
  1. Initialize the client
  2. Get a session token
  3. Check available payment methods
  4. Save a card token
  5. List saved tokens for the customer
  6. Process a payment using the saved token
  7. Check the transaction status

How to run:
  pip install ecollect-sdk
  python example.py
"""

from ecollect import EcollectClient
from ecollect.models import (
    TokenCommandRequest,
    QueryTokenRequest,
    CreateTransactionPaymentRequest,
    GetTransactionInformationRequest,
    GetPaymentSystemRequest,
)
from ecollect.exceptions import EcollectError

# ============================================================
# STEP 0: Initialize the client
# ============================================================
print("=" * 60)
print("ecollect SDK — Full End-to-End Example")
print("=" * 60)

client = EcollectClient(
    api_key="YOUR_API_KEY",   # <-- Replace with your actual API key
    entity_code="50039",      # <-- Replace with your actual entity code
    test_mode=True,           # Using test mode — no real charges!
)

print("Client initialized in TEST mode")

# ============================================================
# STEP 1: Get a session token
# ============================================================
print("\n--- Step 1: Get Session Token ---")

try:
    session = client.get_session_token()
    session_token = session.session_token
    print(f"Session token obtained: {session_token[:20]}...")
except EcollectError as e:
    print(f"Failed to get session token: {e}")
    exit(1)

# ============================================================
# STEP 2: List available payment methods
# ============================================================
print("\n--- Step 2: Available Payment Methods ---")

try:
    ps_request = GetPaymentSystemRequest(session_token=session_token)
    ps_response = client.get_payment_system(ps_request)

    for method in ps_response.payment_systems:
        print(f"  [{method.payment_system_id}] {method.name}")
except EcollectError as e:
    print(f"Could not fetch payment methods: {e}")

# ============================================================
# STEP 3: Save a card token
# ============================================================
print("\n--- Step 3: Save Card Token ---")

card_token = None
try:
    save_request = TokenCommandRequest(
        command="SAVE",
        session_token=session_token,
        card_number="4296005885355275",        # Test card number
        expiration_date="12/2025",             # Test expiry
        payment_system=1,                      # Visa
        fi_code=190,
        cardholder_name="David Caballero",
        cardholder_id_type="CC",
        cardholder_id="123456799",
        email="david.caballero@ecollect.co",
        phone="+1 311111111",
    )

    save_response = client.token_command(save_request)
    card_token = save_response.token
    print(f"Card saved! Token: {card_token}")
except EcollectError as e:
    print(f"Failed to save card: {e}")

# ============================================================
# STEP 4: List all tokens for this customer
# ============================================================
print("\n--- Step 4: List Saved Cards for Customer ---")

try:
    # Get a fresh session token (best practice before each operation)
    session = client.get_session_token()

    query_request = QueryTokenRequest(
        session_token=session.session_token,
        cardholder_id="123456799",
        cardholder_id_type="CC",
    )

    query_response = client.query_token(query_request)
    print(f"Found {len(query_response.tokens)} saved card(s):")
    for card in query_response.tokens:
        print(f"  **** **** **** {card.last_four}  ({card.payment_system_name})")
except EcollectError as e:
    print(f"Could not list tokens: {e}")

# ============================================================
# STEP 5: Process a payment
# ============================================================
print("\n--- Step 5: Process Payment ---")

transaction_id = None
try:
    # Fresh session token for the payment
    session = client.get_session_token()

    payment_request = CreateTransactionPaymentRequest(
        session_token=session.session_token,
        amount=50000,                              # $500.00 COP (50000 cents)
        currency="COP",
        order_id="ORDER-DEMO-001",                 # Your unique order reference
        description="Test purchase via ecollect SDK",
        token=card_token or "DEMO_TOKEN",          # Token saved in step 3
        cardholder_id="123456799",
        cardholder_id_type="CC",
        email="david.caballero@ecollect.co",
        phone="+1 311111111",
        ip_address="192.168.1.100",
    )

    payment_response = client.create_transaction_payment(payment_request)

    if payment_response.approved:
        print("PAYMENT APPROVED!")
        print(f"  Transaction ID:  {payment_response.transaction_id}")
        print(f"  Authorization:   {payment_response.authorization_code}")
        transaction_id = payment_response.transaction_id
    else:
        print("PAYMENT DECLINED")
        print(f"  Reason: {payment_response.response_message}")

except EcollectError as e:
    print(f"Payment error: {e}")

# ============================================================
# STEP 6: Check the transaction status
# ============================================================
if transaction_id:
    print("\n--- Step 6: Check Transaction Status ---")

    try:
        session = client.get_session_token()

        status_request = GetTransactionInformationRequest(
            session_token=session.session_token,
            transaction_id=transaction_id,
        )

        status_response = client.get_transaction_information(status_request)
        print(f"Status:   {status_response.status}")
        print(f"Amount:   {status_response.amount} {status_response.currency}")
        print(f"Date:     {status_response.transaction_date}")
    except EcollectError as e:
        print(f"Could not check status: {e}")

# ============================================================
# Done!
# ============================================================
print("\n" + "=" * 60)
print("End-to-end example completed!")
print("=" * 60)
print("\nNext steps:")
print("  1. Replace YOUR_API_KEY and entity_code with real credentials")
print("  2. Set test_mode=False when ready for production")
print("  3. Store card tokens in your database for repeat customers")
print("  4. Configure a webhook URL in your ecollect dashboard")
```

---

## ⚠️ Common Errors

### `EcollectAuthError: Invalid API key`
**Cause:** The API key you provided is wrong, expired, or has extra spaces.
**Fix:** Log in to your ecollect merchant dashboard, go to API settings, and copy the key again carefully.

### `EcollectConnectionError: Unable to reach server`
**Cause:** Your machine cannot reach the ecollect servers (no internet, firewall, DNS issue).
**Fix:** Check your internet connection. If you are on a corporate network, check with your IT team about firewall rules.

### `EcollectValidationError: field 'card_number' is required`
**Cause:** You forgot a required field in your request object.
**Fix:** Check `e.field` to see the exact field name, then add it to your request.

### `EcollectTimeoutError`
**Cause:** The request took longer than the `timeout` setting (default: 30 seconds).
**Fix:** Increase timeout: `EcollectClient(..., timeout=60)`. Also check the server status.

### `SSL Certificate verification failed`
**Cause:** Your system's SSL/TLS certificates are outdated.
**Fix:** Run `pip install --upgrade certifi` and try again.

### Payment returns `approved=False` with "Insufficient funds"
**Cause:** In test mode, this is a simulated decline to test your decline-handling code.
**Fix:** Use the official test card numbers listed in this guide. Real-looking random numbers will not work.

### `ModuleNotFoundError: No module named 'ecollect'`
**Cause:** The SDK is not installed in the Python environment you are running.
**Fix:** Make sure you activated your virtual environment (`source venv/bin/activate`) and ran `pip install ecollect-sdk`.

---

## ❓ FAQ

**Q: Do I need a dedicated server to use this SDK?**
A: No. You can use it in any Python environment — scripts, Django, Flask, FastAPI, AWS Lambda, Google Cloud Functions, and more.

**Q: Is it safe to store card tokens in my database?**
A: Yes. Tokens are not real card numbers. They are references that only ecollect can resolve. Storing tokens does NOT require PCI DSS compliance on your side.

**Q: What is the difference between API key and entity code?**
A: The API key authenticates you as a developer/merchant. The entity code identifies the specific merchant account to process payments under. Both come from your ecollect merchant dashboard.

**Q: How long do session tokens last?**
A: Session tokens expire quickly (typically a few minutes). Best practice: call `get_session_token()` fresh before each group of API operations rather than reusing tokens from earlier.

**Q: Can I process payments without saving a card token first?**
A: Yes. Pass the card details directly in `CreateTransactionPaymentRequest` instead of a token. The card will not be saved for future use.

**Q: What currencies are supported?**
A: This depends on your ecollect contract. Common ones: COP (Colombia), MXN (Mexico), PEN (Peru). Contact your ecollect account manager for your account's configuration.

**Q: My payment keeps getting declined in test mode.**
A: Use the exact test card number `4296005885355275` with the test data from this guide. Random or real card numbers will be rejected in the test environment.

**Q: How do I go live (production)?**
A: Set `test_mode=False` and use your production API key and entity code. Complete your ecollect merchant onboarding first — they will enable production access.

**Q: Can I use async and sync in the same application?**
A: Yes. The same `EcollectClient` instance has both sync (`client.get_session_token()`) and async (`await client.async_get_session_token()`) methods. Use whichever fits your context.

---

## 📞 Support

- **ecollect Merchant Dashboard:** [https://www.e-collect.com](https://www.e-collect.com)
- **SDK Issues:** Open an issue in the GitHub repository
- **Account support:** Contact ecollect through your merchant dashboard

---

*You've got this! Start with test mode, get comfortable with the flow, then go live with confidence.* 🚀
