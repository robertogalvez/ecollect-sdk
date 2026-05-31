# EcollectSDK — Swift/iOS

Swift SDK for the [ecollect](https://www.e-collect.com) LatAm payment gateway.

- **Swift 5.9+** · **iOS 14+** · **macOS 12+**
- **No external dependencies** — uses Foundation, CryptoKit, and URLSession only
- **Async/await** throughout (Swift Concurrency)
- Distributed via **Swift Package Manager**

---

## Security: mobile initialization

> **The ApiKey is a private credential. Never embed it in an iOS app binary.**

The recommended mobile flow is:

```
1. App → calls your own backend
2. Backend (PHP/Node/Python) → calls ecollect getSessionToken() with ApiKey
3. Backend → returns SessionToken to the app (valid ~30 min)
4. App → initializes EcollectSDK with SessionToken only
5. App → tokenizes card data directly with ecollect (PAN never reaches your backend)
6. App → sends TokenId to your backend
7. Backend → completes payment via ecollect API
```

---

## Installation

### Swift Package Manager

Add to your `Package.swift`:

```swift
dependencies: [
    .package(url: "https://github.com/your-org/ecollect-sdk", from: "1.0.0")
]
```

Or in Xcode: **File → Add Package Dependencies** and paste the repository URL.

---

## Quick start

### Mobile (recommended)

```swift
import EcollectSDK

// SessionToken is obtained from your backend — never hard-code ApiKey in an app
let client = EcollectClient.fromSessionToken(
    sessionTokenFromBackend,
    etyCode: 123,
    environment: .test
)

// Tokenize a card (data goes directly to ecollect, never through your server)
let tokenResponse = try await client.tokens.save(tokenInfoArray: [
    PaymentInfoType(code: AttributeCode.cardNumber,    desc: "CardNumber",    value: "4532015112830366"),
    PaymentInfoType(code: AttributeCode.paymentSystem, desc: "PaymentSystem", value: "1"),
    PaymentInfoType(code: AttributeCode.expirationDate,desc: "ExpirationDate",value: "12/2028"),
    PaymentInfoType(code: AttributeCode.cardHolderName,desc: "CardHolderName",value: "John Doe"),
    PaymentInfoType(code: AttributeCode.cardHolderIdType,desc:"CardHolderIdType",value:"CC"),
    PaymentInfoType(code: AttributeCode.cardHolderId,  desc: "CardHolderId",  value: "12345678"),
    PaymentInfoType(code: AttributeCode.usermail,      desc: "Usermail",      value: "john@example.com"),
    PaymentInfoType(code: AttributeCode.mobileCountryCode,desc:"MobileCountryCode",value:"57"),
    PaymentInfoType(code: AttributeCode.mobileNumber,  desc: "MobileNumber",  value: "3001234567"),
])
// Send tokenId to your backend
let tokenId = tokenResponse.TokenInfoArray?.first(where: { $0.AttributeCode == AttributeCode.tokenId })?.AttributeValue
```

### Server-side (backend only)

```swift
let client = EcollectClient(
    apiKey: "your-private-api-key",   // NEVER in mobile apps
    etyCode: 123,
    environment: .production,
    srvCode: 456
)

let intent = PaymentIntent(
    amount: 150_000,
    currency: "COP",
    referenceArray: ["CC", "12345678", "ORDER-001", "John Doe", "john@example.com", "3001234567"],
    tokenInfoArray: [
        PaymentInfoType(code: AttributeCode.tokenId,       desc: "TokenId",       value: tokenId),
        PaymentInfoType(code: AttributeCode.paymentSystem, desc: "PaymentSystem", value: "1"),
        PaymentInfoType(code: AttributeCode.secureCode,    desc: "SecureCode",    value: "123"),
        PaymentInfoType(code: AttributeCode.installments,  desc: "Installments",  value: "1"),
        PaymentInfoType(code: AttributeCode.fiCode,        desc: "FiCode",        value: "VISA"),
    ]
)

let result = try await client.payments.process(intent)
print("TicketId:", result.TicketId ?? 0)
print("State:", result.TransactionResponse?.TranState ?? "pending")
```

---

## Module reference

### `client.session`
| Method | Description |
|--------|-------------|
| `getSessionToken()` | Returns a valid token (cached or freshly fetched) |
| `refreshToken()` | Forces a new token from ecollect |
| `clearCache()` | Clears cached token |
| `tokenRemainingSeconds` | Seconds until cached token expires |

### `client.payments`
| Method | Description |
|--------|-------------|
| `process(_ intent:)` | Immediate payment (RequestType = 0) |
| `preAuthorize(_ intent:)` | Reserve funds (RequestType = 1) |
| `capture(ticketId:amount:currency:)` | Post/capture a pre-authorization |
| `void(ticketId:)` | Cancel a pre-authorization |
| `hostedCheckout(_ intent:)` | Returns ecollect-hosted URL |

### `client.tokens`
| Method | Description |
|--------|-------------|
| `save(tokenInfoArray:)` | Save card for future use (SAVE) |
| `get(tokenInfoArray:)` | Temporary one-time token (GET) |
| `hold(tokenInfoArray:)` | Token reserved for pre-auth (HOLD) |
| `delete(tokenId:usermail:cardHolderId:)` | Delete saved card (REMOVE) |
| `update(tokenId:newExpiration:)` | Update card expiry (UPDATE) |
| `list(usermail:cardHolderId:)` | List saved cards |

### `client.reconciliation`
| Method | Description |
|--------|-------------|
| `getTransactionStatus(ticketId:)` | Single status query |
| `getTransactionStatusByMerchantId(_:)` | Fallback by MerchantTransactionId |
| `reconciliate(ticketId:timeout:)` | Polls until final state (Proceso Sonda) |

### `client.webhooks`
| Method | Description |
|--------|-------------|
| `verifyWebhookSignature(payload:signature:secret:)` | HMAC-SHA256 check |
| `confirmWebhook(sessionTokenToVerify:ticketIdToVerify:)` | API-based verification |

### `client.customers`
| Method | Description |
|--------|-------------|
| `getOrCreateCustomerId(...)` | Persistent CustomerId for multi-card tokenization |

### `client.paymentSystems`
| Method | Description |
|--------|-------------|
| `getPaymentSystems()` | List enabled payment methods for this merchant |

### `client.paymentLinks`
| Method | Description |
|--------|-------------|
| `generatePaymentLink(intent:method:)` | Email / SMS / QR link (PaymentSystem=10) |

---

## Error handling

All errors are typed as `EcollectError`:

```swift
do {
    let result = try await client.payments.process(intent)
} catch EcollectError.sessionExpired(let msg) {
    // Session auto-refreshed and retried once; if still failing, re-authenticate
} catch EcollectError.invalidCard(let msg) {
    // Show card error to user
} catch EcollectError.duplicateTransaction(let msg) {
    // MerchantTransactionId already used — check transaction status instead of retrying
} catch EcollectError.networkRetryable(let msg) {
    // Automatic 3-retry exponential backoff already attempted; final failure
} catch EcollectError.pollingTimeout(let msg) {
    // Polling exceeded timeout; check status manually
} catch EcollectError.apiError(let code, let message) {
    // Unmapped ecollect error code
}
```

---

## Double-payment protection

States `BANK`, `PENDING`, `CAPTURED`, and `CREATED` indicate the user may be actively paying. **Do not retry** when a transaction is in these states — query `getTransactionStatus` until a final state (`OK`, `NOT_AUTHORIZED`, `EXPIRED`, `FAILED`) is reached.

```swift
let status = try await client.reconciliation.reconciliate(ticketId: 12345, timeout: 600)
if status.TranState == "OK" {
    // Payment confirmed
}
```

---

## Running tests

```bash
cd packages/swift
swift test
```

Tests use `URLProtocol` stubs (`MockURLProtocol`) — no real network calls.

---

## Environments

| Environment | Base URL |
|-------------|----------|
| `.test` | `https://test1.e-collect.com/app_express/api/` |
| `.production` | `https://www.e-collect.com/app_Express/api/` |

Production `getTransactionInformation` uses `https://m.e-collect.com/app_Express/api/GetTransactionInformation`.

---

## Supported countries & payment systems

| Code | Name | Country |
|------|------|---------|
| 0 | PSE | Colombia |
| 1 | Credit Card | Colombia |
| 3 | Credit Card (VISANET) | Dominican Republic |
| 6 | Credit Card (CARDNET) | Dominican Republic |
| 7 | SPEI | Mexico |
| 10 | Payment Link (email/SMS/QR) | All |
| 100 | Cash / In-person | All |
