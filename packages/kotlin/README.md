# ecollect Kotlin/Android SDK

Kotlin SDK for integrating with the [ecollect](https://www.e-collect.com) LatAm payment gateway. Built with OkHttp + Coroutines for Android-native async patterns.

## Requirements

- JVM 11+ (standard JVM project; Android API 21+ when used in an Android project)
- Kotlin 1.9+

## Installation

Add to your `build.gradle.kts`:

```kotlin
dependencies {
    implementation("com.ecollect:ecollect-sdk-kotlin:0.1.0")
}
```

## Quick Start

### Server-side (with ApiKey)

```kotlin
val client = EcollectClient.Builder()
    .apiKey("your-private-api-key")   // NEVER put this in an APK
    .etyCode(123)
    .environment(Environment.TEST)
    .srvCode(456)
    .build()

// Process a payment
val intent = PaymentIntent(
    amount = 50000.0,
    currency = "COP",
    referenceArray = listOf("CC", "12345678", "ORD-001", "John Doe", "j@example.com", "3001234567"),
    tokenId = "tok_xxx",
    paymentSystem = "1",
    fiCode = "VISA",
    usermail = "j@example.com"
)

val result = client.payments.process(intent)
println("TicketId: ${result.ticketId}")
```

### Mobile (SessionToken only — recommended for Android)

```kotlin
// Your backend obtains the sessionToken using ApiKey, then passes it to the app
val client = EcollectClient.fromSessionToken(
    sessionToken = "session-token-from-your-backend",
    etyCode = 123,
    environment = Environment.TEST
)

// Tokenize a card (data goes directly to ecollect, never to your backend)
val tokenResult = client.tokens.save(
    cardNumber = "4111111111111111",
    expirationDate = "12/2030",
    paymentSystem = "1",
    fiCode = "VISA",
    cardHolderName = "John Doe",
    cardHolderIdType = "CC",
    cardHolderId = "12345678",
    usermail = "j@example.com",
    mobileCountryCode = "57",
    mobileNumber = "3001234567"
)
val tokenId = tokenResult.tokenInfoArray?.find { it.attributeCode == 1 }?.attributeValue
// Send tokenId to your backend to complete the payment
```

## Mobile Security Model

```
1. App → calls your backend
2. Backend → calls ecollect.getSessionToken() with ApiKey (server-side only)
3. Backend → returns SessionToken to the app (valid ~30 min)
4. App → uses SDK with SessionToken to tokenize card
   (card data goes DIRECTLY to ecollect, never touches your backend)
5. ecollect → returns TokenId to the app
6. App → sends TokenId to your backend
7. Backend → calls ecollect.createTransactionPayment() with TokenId
```

**The ApiKey is NEVER stored in the APK or passed to EcollectClient on mobile.**

## API Reference

### Payments

```kotlin
// Immediate payment
client.payments.process(intent)

// Pre-authorization (hold funds)
val preAuth = client.payments.preAuthorize(intent)
val ticketId = preAuth.ticketId!!

// Capture pre-authorized amount
client.payments.capture(ticketId, finalAmount = 45000.0, currency = "COP", referenceArray = refs)

// Void pre-authorization
client.payments.void(ticketId, amount = 50000.0, currency = "COP", referenceArray = refs)

// Hosted checkout (redirect user to ecollect's payment page)
val checkout = client.payments.hostedCheckout(intent.copy(urlRedirect = "https://yoursite.com/return"))
// Redirect user to checkout.eCollectUrl
```

### Tokens

```kotlin
// Save card (persistent)
client.tokens.save(cardNumber, expirationDate, paymentSystem, fiCode, ...)

// Temporary token for one-time payment
client.tokens.get(cardNumber, ...)

// Hold token for pre-authorization
client.tokens.hold(cardNumber, ...)

// Update card expiry
client.tokens.update(tokenId, expirationDate = "06/2028", ...)

// Delete saved card
client.tokens.delete(tokenId, paymentSystem, fiCode, cardHolderId)

// List saved cards
val cards = client.tokens.list(usermail = "j@example.com", cardHolderId = "12345678")
```

### Reconciliation (Proceso Sonda)

```kotlin
// One-time status check
val status = client.reconciliation.getTransactionStatus(ticketId = 98765)
println("TranState: ${status.tranState}")

// Poll until final state (OK, NOT_AUTHORIZED, EXPIRED, FAILED)
val finalStatus = client.reconciliation.reconciliate(ticketId = 98765, timeoutMs = 600_000)
```

### Webhooks

```kotlin
// Verify an incoming webhook from ecollect
val isValid = client.webhooks.confirmWebhook(
    sessionTokenToVerify = webhookPayload.sessionToken!!,
    ticketIdToVerify = webhookPayload.ticketId
)
```

### Payment Links (SMS/QR/Email)

```kotlin
// Email link
val link = client.paymentLinks.generatePaymentLink(intent, method = PaymentLinkMethod.EMAIL)

// SMS link
val smsIntent = intent.copy(mobileCountryCode = "57", mobileNumber = "3001234567")
val smsLink = client.paymentLinks.generatePaymentLink(smsIntent, method = PaymentLinkMethod.SMS)

// QR code (returns eCollectUrl for QR generation)
val qrLink = client.paymentLinks.generatePaymentLink(intent, method = PaymentLinkMethod.QR)
```

### Customers

```kotlin
val customerId = client.customers.getOrCreateCustomerId(
    usermail = "j@example.com",
    cardHolderId = "12345678",
    cardHolderName = "John Doe",
    cardHolderIdType = "CC",
    mobileCountryCode = "57",
    mobileNumber = "3001234567"
)
```

### Payment Systems

```kotlin
val systems = client.paymentSystems.getPaymentSystems()
systems.paymentSystemArray?.forEach { system ->
    println("PaymentSystem: ${system.paymentSystem}")
    system.fiArray?.forEach { fi -> println("  - ${fi.fiCode}: ${fi.fiName}") }
}
```

## Error Handling

```kotlin
try {
    val result = client.payments.process(intent)
} catch (e: SessionExpiredException) {
    // Session expired; get a new one from your backend and retry
} catch (e: InvalidCardException) {
    // Show card error to user
} catch (e: DuplicateTransactionException) {
    // MerchantTransactionId already used; check transaction status
} catch (e: NetworkRetryableException) {
    // Temporary server error; the SDK retries automatically (3x with exponential backoff)
} catch (e: ValidationException) {
    // Invalid input data
} catch (e: EcollectException) {
    // Base class for all SDK exceptions
}
```

## URLs

| Environment | Base URL |
|---|---|
| Test | `https://test1.e-collect.com/app_express/api/` |
| Production | `https://www.e-collect.com/app_Express/api/` |
| Production (GetTransactionInformation) | `https://m.e-collect.com/app_Express/api/GetTransactionInformation` |

## Building

```bash
cd packages/kotlin
./gradlew build
./gradlew test
```
