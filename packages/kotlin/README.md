# 🚀 ecollect Kotlin/Android SDK — Complete Guide

Welcome to the **ecollect Kotlin SDK**! This guide is written for Android and JVM developers of all experience levels. Every step is explained in detail so you can integrate payments confidently.

---

## 📋 Table of Contents

1. [What is ecollect?](#what-is-ecollect)
2. [Prerequisites](#prerequisites)
3. [Installation](#installation)
4. [Setup — Creating the Client](#setup--creating-the-client)
5. [Coroutine-Based Async API](#coroutine-based-async-api)
6. [Getting a Session Token](#getting-a-session-token)
7. [Saving a Card Token](#saving-a-card-token)
8. [Listing Saved Tokens](#listing-saved-tokens)
9. [Processing a Payment](#processing-a-payment)
10. [Getting Available Payment Systems](#getting-available-payment-systems)
11. [Checking Transaction Status](#checking-transaction-status)
12. [Webhook Verification](#webhook-verification)
13. [Error Handling](#error-handling)
14. [Test vs Production](#test-vs-production)
15. [Android Integration Tips](#android-integration-tips)
16. [Full Working Example](#full-working-example)
17. [Common Errors](#common-errors)
18. [FAQ](#faq)

---

## 💡 What is ecollect?

**ecollect** is a Latin American payment gateway that allows your application to:

- Accept credit and debit card payments (Visa, Mastercard, and more)
- Process bank transfers (PSE in Colombia, SPEI in Mexico, and others)
- Save card information securely using **tokens** (so customers don't type their card number every time)
- Check the status of past transactions
- Verify webhooks sent by ecollect to your server

This SDK is built for **Android** and **JVM (backend)** projects using Kotlin. It uses **OkHttp** for networking and **Kotlin Coroutines** for non-blocking async operations.

> 🏦 **Where do I get my credentials?** Your **API Key** and **Entity Code** come from the ecollect merchant dashboard. Contact your ecollect account manager to get access.

---

## ✅ Prerequisites

Before you start, make sure you have:

| Requirement | Minimum Version | Notes |
|---|---|---|
| JDK | 17 or higher | `java -version` to check |
| Kotlin | 1.9 or higher | Included with Android Studio |
| Android Studio | Hedgehog (2023.1.1+) | For Android projects |
| Gradle | 8.0 or higher | Usually bundled with your project |
| `minSdk` | 21 (Android 5.0) | For Android projects |

### Checking your JDK version

Open a terminal and type:

```bash
java -version
# Expected output: openjdk version "17.x.x" or similar
```

If you see version 11 or lower, download JDK 17 from [https://adoptium.net/](https://adoptium.net/).

---

## 📦 Installation

### Android / JVM project (Gradle with Kotlin DSL)

Open your module-level `build.gradle.kts` file and add the dependency:

```kotlin
// build.gradle.kts (module level — usually app/build.gradle.kts)

dependencies {
    // ecollect SDK for payments
    implementation("com.ecollect:ecollect-sdk:1.0.0")

    // Required: Kotlin coroutines (if not already included)
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.7.3")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-core:1.7.3")
}
```

For Groovy DSL (`build.gradle`):

```groovy
// build.gradle (module level)
dependencies {
    implementation 'com.ecollect:ecollect-sdk:1.0.0'
    implementation 'org.jetbrains.kotlinx:kotlinx-coroutines-android:1.7.3'
}
```

### Android: Add internet permission

Open `AndroidManifest.xml` and add the internet permission (required for all network requests):

```xml
<!-- AndroidManifest.xml -->
<manifest xmlns:android="http://schemas.android.com/apk/res/android">

    <!-- Required: allows the app to connect to the internet -->
    <uses-permission android:name="android.permission.INTERNET" />

    <application
        ...
    </application>
</manifest>
```

### Sync your project

In Android Studio: click **File → Sync Project with Gradle Files** (or click the elephant icon in the toolbar).

---

## 🔧 Setup — Creating the Client

The `EcollectClient` is the main object you use to talk to the ecollect API. Create it once and reuse it throughout your app (see Android ViewModel tips below for the best way to do this).

```kotlin
import com.ecollect.sdk.EcollectClient
import com.ecollect.sdk.EcollectConfig

// Create the configuration object
val config = EcollectConfig(
    apiKey = "YOUR_API_KEY_HERE",         // API key from your ecollect dashboard
    entityCode = "YOUR_ENTITY_CODE",      // Your entity code (e.g., "50039")
    testMode = true,                      // true  = test environment (no real charges!)
                                          // false = production (real money!)
)

// Create the client using the config
val client = EcollectClient(config)
```

### All available config options

```kotlin
import com.ecollect.sdk.EcollectConfig

val config = EcollectConfig(
    apiKey = "YOUR_API_KEY_HERE",         // Required: your API key
    entityCode = "YOUR_ENTITY_CODE",      // Required: your entity code
    testMode = true,                      // Optional: default is false (production)
    timeoutSeconds = 30L,                 // Optional: HTTP timeout (default: 30 seconds)
    maxRetries = 3,                       // Optional: retries on failure (default: 3)
)
```

### Test vs Production URLs

| Mode | URL |
|---|---|
| Test (`testMode = true`) | `https://test1.e-collect.com/app_express/api/` |
| Production (`testMode = false`) | `https://www.e-collect.com/app_Express/api/` |
| Production — Transaction Info | `https://m.e-collect.com/app_Express/api/GetTransactionInformation` |

> ⚠️ **Important:** The test environment does **NOT** charge real money. Always use `testMode = true` during development and testing.

---

## ⚡ Coroutine-Based Async API

All network calls in this SDK are **suspending functions** — they must be called from within a coroutine scope. This keeps your UI responsive while waiting for network responses.

### What are coroutines?

Coroutines are Kotlin's way of writing asynchronous code that looks like sequential code. Instead of callbacks or complex threading, you use `suspend fun` and `launch`/`async`.

```kotlin
// This function is a coroutine — it can be suspended (paused) without blocking a thread
suspend fun doSomething() {
    val result = client.getSessionToken()   // Suspends here, doesn't block the thread
    println(result.sessionToken)             // Resumes here when the response arrives
}
```

### Running a coroutine in Android (ViewModel)

```kotlin
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.launch

class PaymentViewModel : ViewModel() {

    fun fetchToken() {
        // viewModelScope automatically cancels the coroutine when the ViewModel is destroyed
        viewModelScope.launch {
            try {
                val response = client.getSessionToken()   // Safe to call here
                // Update UI with response...
            } catch (e: EcollectException) {
                // Handle error...
            }
        }
    }
}
```

### Running a coroutine in a standalone JVM app

```kotlin
import kotlinx.coroutines.runBlocking

fun main() = runBlocking {
    // runBlocking bridges the sync world and coroutine world
    // Use only for top-level main() functions or tests — NOT in Android UI code
    val response = client.getSessionToken()
    println(response.sessionToken)
}
```

---

## 🔑 Getting a Session Token

Before making most API calls, you need a **session token**. It is a temporary credential that proves you are allowed to make requests. Always get a fresh token before important operations.

```kotlin
import com.ecollect.sdk.EcollectClient
import com.ecollect.sdk.EcollectConfig
import com.ecollect.sdk.exceptions.EcollectException
import kotlinx.coroutines.runBlocking

val config = EcollectConfig(
    apiKey = "YOUR_API_KEY",
    entityCode = "50039",
    testMode = true,
)
val client = EcollectClient(config)

runBlocking {
    // Request a session token from the ecollect API
    val response = client.getSessionToken()

    // response contains the token and expiry information
    println("Session token: ${response.sessionToken}")
    println("Expires at: ${response.expiresAt}")
    println("Status: ${response.status}")
}
```

### Response fields

| Field | Type | Description |
|---|---|---|
| `sessionToken` | `String` | Token to use in subsequent requests |
| `expiresAt` | `Instant` | When this token expires |
| `status` | `String` | `"SUCCESS"` if everything worked |

---

## 💳 Saving a Card Token

Card **tokenization** lets you save a customer's card securely. ecollect stores the actual card number and gives you back a safe **token** you can store in your database and use for future payments — no PCI compliance headaches on your side.

```kotlin
import com.ecollect.sdk.EcollectClient
import com.ecollect.sdk.EcollectConfig
import com.ecollect.sdk.models.TokenCommandRequest
import com.ecollect.sdk.exceptions.EcollectException
import kotlinx.coroutines.runBlocking

val config = EcollectConfig(apiKey = "YOUR_API_KEY", entityCode = "50039", testMode = true)
val client = EcollectClient(config)

runBlocking {
    // Step 1: Get a session token
    val session = client.getSessionToken()

    // Step 2: Build the save card request using Kotlin's named arguments
    val request = TokenCommandRequest(
        command = "SAVE",                            // Tell ecollect to SAVE a new card
        sessionToken = session.sessionToken,          // The session token we just got
        cardNumber = "4296005885355275",              // Customer's card number
        expirationDate = "12/2025",                  // Expiry in MM/YYYY format
        paymentSystem = 1,                           // 1 = Visa
        fiCode = 190,                                // Financial institution code
        cardholderName = "David Caballero",          // Name as printed on the card
        cardholderIdType = "CC",                     // CC = Colombian Cédula
        cardholderId = "123456799",                  // Customer's national ID number
        email = "david.caballero@ecollect.co",       // Customer email
        phone = "+1 311111111",                      // Customer phone
    )

    // Step 3: Execute the command
    val response = client.tokenCommand(request)

    // Step 4: Store response.token in your database for future payments!
    println("Card saved! Token: ${response.token}")
    println("Status: ${response.status}")
}
```

### Other token commands

| Command | Description |
|---|---|
| `SAVE` | Save a new card and get a reusable token |
| `GET` | Retrieve masked card details using a token |
| `REMOVE` | Delete a saved card token permanently |
| `UPDATE` | Update card details (e.g., new expiry) |
| `HOLD` | Temporarily freeze a card token |

#### GET — Retrieve a saved card

```kotlin
val request = TokenCommandRequest(
    command = "GET",
    sessionToken = session.sessionToken,    // Active session token
    token = "CARD_TOKEN_HERE",              // The token you stored earlier
)

val response = client.tokenCommand(request)
println("Cardholder: ${response.cardholderName}")
println("Last 4: ${response.lastFour}")       // e.g., "5275"
```

#### REMOVE — Delete a saved card

```kotlin
val request = TokenCommandRequest(
    command = "REMOVE",
    sessionToken = session.sessionToken,
    token = "CARD_TOKEN_HERE",
)

val response = client.tokenCommand(request)
println("Removed: ${response.status}")
```

---

## 📋 Listing Saved Tokens

Use `queryToken` to list all saved cards for a specific customer. Perfect for building a "Saved payment methods" screen.

```kotlin
import com.ecollect.sdk.models.QueryTokenRequest
import kotlinx.coroutines.runBlocking

runBlocking {
    // Get a fresh session token
    val session = client.getSessionToken()

    // Build the query — identify the customer by their national ID
    val request = QueryTokenRequest(
        sessionToken = session.sessionToken,   // Active session token
        cardholderId = "123456799",            // Customer's national ID
        cardholderIdType = "CC",               // ID type
    )

    // Execute the query
    val response = client.queryToken(request)

    // Display all saved cards
    println("Found ${response.tokens.size} saved card(s):")
    for (card in response.tokens) {
        println("  Token:   ${card.token}")
        println("  Card:    **** **** **** ${card.lastFour}")
        println("  Type:    ${card.paymentSystemName}")    // e.g., "Visa"
        println("  Expires: ${card.expirationDate}")
        println()
    }
}
```

---

## 💰 Processing a Payment

The `createTransactionPayment` function charges a customer. You can pay using:
1. A **card token** (saved previously — best for returning customers)
2. **Card details directly** (for one-time payments)

### Payment with a saved token

```kotlin
import com.ecollect.sdk.models.CreateTransactionPaymentRequest
import kotlinx.coroutines.runBlocking

runBlocking {
    // Always get a fresh session token before a payment
    val session = client.getSessionToken()

    // Build the payment request
    val request = CreateTransactionPaymentRequest(
        sessionToken = session.sessionToken,       // Active session token
        amount = 50000,                            // Amount in smallest currency unit
                                                   // 50000 centavos = $500.00 COP
        currency = "COP",                          // Currency: COP, MXN, PEN, etc.
        orderId = "ORDER-001",                     // YOUR unique order reference
        description = "Purchase at My Store",     // Human-readable description
        token = "CARD_TOKEN_HERE",                // Token from a previously saved card
        cardholderId = "123456799",               // Customer's national ID
        cardholderIdType = "CC",                  // ID type
        email = "david.caballero@ecollect.co",    // Customer email (for receipt)
        phone = "+1 311111111",                   // Customer phone
        ipAddress = "192.168.1.1",                // Customer's IP address
    )

    val response = client.createTransactionPayment(request)

    if (response.approved) {
        println("✅ Payment APPROVED!")
        println("Transaction ID: ${response.transactionId}")       // SAVE THIS!
        println("Authorization:  ${response.authorizationCode}")
    } else {
        println("❌ Payment DECLINED")
        println("Reason: ${response.responseMessage}")
        println("Code:   ${response.responseCode}")
    }
}
```

### Payment with card details directly

```kotlin
val request = CreateTransactionPaymentRequest(
    sessionToken = session.sessionToken,
    amount = 50000,
    currency = "COP",
    orderId = "ORDER-002",
    description = "One-time purchase",
    // Use card details instead of a token
    cardNumber = "4296005885355275",
    expirationDate = "12/2025",
    paymentSystem = 1,             // 1 = Visa
    fiCode = 190,
    cardholderName = "David Caballero",
    cardholderId = "123456799",
    cardholderIdType = "CC",
    email = "david.caballero@ecollect.co",
    phone = "+1 311111111",
    ipAddress = "192.168.1.1",
)

val response = client.createTransactionPayment(request)
println("Approved: ${response.approved}")
println("Transaction ID: ${response.transactionId}")
```

---

## 🏦 Getting Available Payment Systems

Use `getPaymentSystem` to list all payment methods enabled for your account.

```kotlin
import com.ecollect.sdk.models.GetPaymentSystemRequest
import kotlinx.coroutines.runBlocking

runBlocking {
    val session = client.getSessionToken()

    val request = GetPaymentSystemRequest(
        sessionToken = session.sessionToken,
    )

    val response = client.getPaymentSystem(request)

    println("Available payment methods:")
    for (method in response.paymentSystems) {
        println("  [${method.paymentSystemId}] ${method.name}")
        // Example:
        // [1] Visa
        // [2] Mastercard
        // [5] PSE
    }
}
```

---

## 🔍 Checking Transaction Status

Use `getTransactionInformation` to look up the status of any transaction.

> 📌 **Note:** In production, this uses a special URL. The SDK handles it automatically.

```kotlin
import com.ecollect.sdk.models.GetTransactionInformationRequest
import kotlinx.coroutines.runBlocking

runBlocking {
    val session = client.getSessionToken()

    val request = GetTransactionInformationRequest(
        sessionToken = session.sessionToken,
        transactionId = "TRANSACTION_ID_HERE",   // ID from the original payment response
    )

    val response = client.getTransactionInformation(request)

    println("Status:        ${response.status}")       // APPROVED, DECLINED, PENDING
    println("Amount:        ${response.amount}")
    println("Currency:      ${response.currency}")
    println("Date:          ${response.transactionDate}")
    println("Authorization: ${response.authorizationCode}")
}
```

---

## 🔒 Webhook Verification

When a payment completes, ecollect sends a webhook to a URL you configure in your dashboard. Always verify the session token included in the webhook to confirm it came from ecollect.

```kotlin
import com.ecollect.sdk.EcollectClient

// The token received in the webhook payload
val incomingToken = "TOKEN_FROM_WEBHOOK_PAYLOAD"

// Returns true if authentic, false if invalid
val isValid = client.verifySessionToken(incomingToken)

if (isValid) {
    println("✅ Webhook verified — safe to process")
    // Update your database, fulfill the order, etc.
} else {
    println("❌ Webhook invalid — rejecting!")
    // Return HTTP 401 to the sender
}
```

### Ktor server example

```kotlin
import io.ktor.server.application.*
import io.ktor.server.request.*
import io.ktor.server.response.*
import io.ktor.server.routing.*

routing {
    post("/webhook/ecollect") {
        // Parse the JSON payload
        val payload = call.receive<Map<String, String>>()
        val sessionToken = payload["session_token"]

        if (sessionToken == null) {
            call.respond(HttpStatusCode.BadRequest, "Missing session_token")
            return@post
        }

        // Verify the token is genuinely from ecollect
        val isValid = client.verifySessionToken(sessionToken)

        if (!isValid) {
            call.respond(HttpStatusCode.Unauthorized, "Invalid session token")
            return@post
        }

        // Process the legitimate webhook
        val transactionId = payload["transaction_id"]
        val status = payload["status"]
        println("Transaction $transactionId is now: $status")

        call.respond(HttpStatusCode.OK, mapOf("received" to true))
    }
}
```

---

## ❌ Error Handling

The SDK throws typed exceptions you can catch and handle individually.

### All exception classes

| Exception | When it is thrown |
|---|---|
| `EcollectAuthException` | Invalid API key or entity code |
| `EcollectConnectionException` | Cannot reach the ecollect server |
| `EcollectTimeoutException` | Request timed out |
| `EcollectValidationException` | Invalid or missing request parameters |
| `EcollectApiException` | API returned a business logic error |
| `EcollectException` | Base class — catches any of the above |

### Comprehensive error handling example

```kotlin
import com.ecollect.sdk.exceptions.*

viewModelScope.launch {
    try {
        val session = client.getSessionToken()

        val request = CreateTransactionPaymentRequest(
            sessionToken = session.sessionToken,
            amount = 50000,
            currency = "COP",
            orderId = "ORDER-004",
            description = "Test",
            token = "CARD_TOKEN_HERE",
            cardholderId = "123456799",
            cardholderIdType = "CC",
            email = "customer@example.com",
            phone = "+1 311111111",
            ipAddress = "192.168.1.1",
        )

        val response = client.createTransactionPayment(request)
        // Handle success...

    } catch (e: EcollectAuthException) {
        // Wrong API key or entity code
        showError("Authentication failed. Check your credentials.")

    } catch (e: EcollectConnectionException) {
        // No internet or server unreachable
        showError("Connection failed. Check your internet connection.")

    } catch (e: EcollectTimeoutException) {
        // Server took too long to respond
        showError("Request timed out. Please try again.")
        // IMPORTANT: check transaction status before retrying to avoid double charges!

    } catch (e: EcollectValidationException) {
        // Missing or invalid field in request
        showError("Invalid data: ${e.field} — ${e.message}")

    } catch (e: EcollectApiException) {
        // Business error from ecollect (e.g., card declined)
        showError("Payment error [${e.code}]: ${e.message}")

    } catch (e: EcollectException) {
        // Any other ecollect SDK error
        showError("Unexpected error: ${e.message}")
    }
}
```

---

## 🌍 Test vs Production

### Using the test environment

```kotlin
val config = EcollectConfig(
    apiKey = "YOUR_TEST_API_KEY",
    entityCode = "50039",
    testMode = true,    // ← Test mode: no real charges
)
```

### Switching to production

```kotlin
val config = EcollectConfig(
    apiKey = BuildConfig.ECOLLECT_API_KEY,          // From your build config
    entityCode = BuildConfig.ECOLLECT_ENTITY_CODE,  // From your build config
    testMode = false,   // ← Production: real money!
)
```

### Storing credentials securely in Android

Never hardcode API keys in your source code. Use `local.properties` + `BuildConfig`:

```properties
# local.properties (NEVER commit this file to git!)
ECOLLECT_API_KEY=your_api_key_here
ECOLLECT_ENTITY_CODE=50039
ECOLLECT_TEST_MODE=true
```

```kotlin
// build.gradle.kts
android {
    defaultConfig {
        // Read from local.properties and inject into BuildConfig
        buildConfigField(
            "String",
            "ECOLLECT_API_KEY",
            "\"${project.findProperty("ECOLLECT_API_KEY") ?: ""}\""
        )
        buildConfigField(
            "String",
            "ECOLLECT_ENTITY_CODE",
            "\"${project.findProperty("ECOLLECT_ENTITY_CODE") ?: ""}\""
        )
        buildConfigField(
            "Boolean",
            "ECOLLECT_TEST_MODE",
            "${project.findProperty("ECOLLECT_TEST_MODE") ?: true}"
        )
    }
    buildFeatures {
        buildConfig = true
    }
}
```

```kotlin
// Now use BuildConfig in your code
val config = EcollectConfig(
    apiKey = BuildConfig.ECOLLECT_API_KEY,
    entityCode = BuildConfig.ECOLLECT_ENTITY_CODE,
    testMode = BuildConfig.ECOLLECT_TEST_MODE,
)
```

### Test card data

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

## 📱 Android Integration Tips

### 1. Use a ViewModel to hold the client

```kotlin
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.ecollect.sdk.EcollectClient
import com.ecollect.sdk.EcollectConfig
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch

class PaymentViewModel : ViewModel() {

    // Create the client once in the ViewModel — survives configuration changes
    private val client = EcollectClient(
        EcollectConfig(
            apiKey = BuildConfig.ECOLLECT_API_KEY,
            entityCode = BuildConfig.ECOLLECT_ENTITY_CODE,
            testMode = BuildConfig.ECOLLECT_TEST_MODE,
        )
    )

    // Sealed class to represent the state of a payment operation
    sealed class PaymentState {
        object Idle : PaymentState()
        object Loading : PaymentState()
        data class Success(val transactionId: String) : PaymentState()
        data class Error(val message: String) : PaymentState()
    }

    // StateFlow so the UI can observe changes
    private val _paymentState = MutableStateFlow<PaymentState>(PaymentState.Idle)
    val paymentState: StateFlow<PaymentState> = _paymentState

    fun processPayment(cardToken: String, amount: Int) {
        viewModelScope.launch {
            _paymentState.value = PaymentState.Loading

            try {
                // Get a session token
                val session = client.getSessionToken()

                // Create the payment
                val response = client.createTransactionPayment(
                    CreateTransactionPaymentRequest(
                        sessionToken = session.sessionToken,
                        amount = amount,
                        currency = "COP",
                        orderId = "ORDER-${System.currentTimeMillis()}",
                        description = "Purchase",
                        token = cardToken,
                        cardholderId = "123456799",
                        cardholderIdType = "CC",
                        email = "customer@example.com",
                        phone = "+1 311111111",
                        ipAddress = "0.0.0.0",    // Use real IP in production
                    )
                )

                if (response.approved) {
                    _paymentState.value = PaymentState.Success(response.transactionId)
                } else {
                    _paymentState.value = PaymentState.Error(response.responseMessage)
                }

            } catch (e: EcollectException) {
                _paymentState.value = PaymentState.Error(e.message ?: "Unknown error")
            }
        }
    }
}
```

### 2. Observe state in your Fragment/Activity

```kotlin
import androidx.fragment.app.Fragment
import androidx.fragment.app.viewModels
import androidx.lifecycle.lifecycleScope
import kotlinx.coroutines.launch

class CheckoutFragment : Fragment() {

    // Get a reference to the ViewModel
    private val viewModel: PaymentViewModel by viewModels()

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)

        // Observe the payment state
        viewLifecycleOwner.lifecycleScope.launch {
            viewModel.paymentState.collect { state ->
                when (state) {
                    is PaymentViewModel.PaymentState.Idle -> {
                        // Show the payment form
                    }
                    is PaymentViewModel.PaymentState.Loading -> {
                        // Show a loading spinner
                        progressBar.visibility = View.VISIBLE
                    }
                    is PaymentViewModel.PaymentState.Success -> {
                        // Payment worked! Navigate to confirmation screen
                        progressBar.visibility = View.GONE
                        navigateToConfirmation(state.transactionId)
                    }
                    is PaymentViewModel.PaymentState.Error -> {
                        // Show the error to the user
                        progressBar.visibility = View.GONE
                        showErrorDialog(state.message)
                    }
                }
            }
        }

        // Trigger a payment when the button is tapped
        payButton.setOnClickListener {
            viewModel.processPayment(
                cardToken = savedCardToken,
                amount = 50000,
            )
        }
    }
}
```

### 3. Never call network code on the main thread

```kotlin
// ❌ WRONG — this will crash with NetworkOnMainThreadException
fun badExample() {
    val session = client.getSessionToken()   // Will crash!
}

// ✅ CORRECT — always use a coroutine scope
fun goodExample() {
    viewModelScope.launch {
        val session = client.getSessionToken()   // Safe!
    }
}
```

### 4. Inject the client with dependency injection (Hilt)

```kotlin
// In your Hilt module
@Module
@InstallIn(SingletonComponent::class)
object EcollectModule {

    @Provides
    @Singleton
    fun provideEcollectClient(): EcollectClient {
        return EcollectClient(
            EcollectConfig(
                apiKey = BuildConfig.ECOLLECT_API_KEY,
                entityCode = BuildConfig.ECOLLECT_ENTITY_CODE,
                testMode = BuildConfig.ECOLLECT_TEST_MODE,
            )
        )
    }
}

// In your ViewModel
@HiltViewModel
class PaymentViewModel @Inject constructor(
    private val ecollectClient: EcollectClient,
) : ViewModel() {
    // Use ecollectClient here
}
```

---

## 🎯 Full Working Example

### Standalone JVM / Backend (runBlocking)

```kotlin
/**
 * ecollect Kotlin SDK — Full End-to-End Example
 *
 * Demonstrates the complete payment flow:
 * 1. Initialize the client
 * 2. Get a session token
 * 3. List available payment methods
 * 4. Save a card token
 * 5. List saved tokens
 * 6. Process a payment
 * 7. Check transaction status
 */

import com.ecollect.sdk.EcollectClient
import com.ecollect.sdk.EcollectConfig
import com.ecollect.sdk.models.*
import com.ecollect.sdk.exceptions.EcollectException
import kotlinx.coroutines.runBlocking

fun main() = runBlocking {
    println("=" .repeat(60))
    println("ecollect Kotlin SDK — Full End-to-End Example")
    println("=" .repeat(60))

    // --------------------------------------------------------
    // Step 0: Initialize the client
    // --------------------------------------------------------
    val client = EcollectClient(
        EcollectConfig(
            apiKey = "YOUR_API_KEY",       // ← Replace with your API key
            entityCode = "50039",           // ← Replace with your entity code
            testMode = true,               // Test mode — no real charges!
        )
    )
    println("Client initialized in TEST mode")

    // --------------------------------------------------------
    // Step 1: Get a session token
    // --------------------------------------------------------
    println("\n--- Step 1: Get Session Token ---")

    val sessionToken: String
    try {
        val session = client.getSessionToken()
        sessionToken = session.sessionToken
        println("Token obtained: ${sessionToken.take(20)}...")
    } catch (e: EcollectException) {
        println("FAILED to get session token: ${e.message}")
        return@runBlocking
    }

    // --------------------------------------------------------
    // Step 2: List available payment methods
    // --------------------------------------------------------
    println("\n--- Step 2: Available Payment Methods ---")
    try {
        val psResponse = client.getPaymentSystem(
            GetPaymentSystemRequest(sessionToken = sessionToken)
        )
        for (method in psResponse.paymentSystems) {
            println("  [${method.paymentSystemId}] ${method.name}")
        }
    } catch (e: EcollectException) {
        println("Could not fetch methods: ${e.message}")
    }

    // --------------------------------------------------------
    // Step 3: Save a card token
    // --------------------------------------------------------
    println("\n--- Step 3: Save Card Token ---")

    var cardToken: String? = null
    try {
        val saveResponse = client.tokenCommand(
            TokenCommandRequest(
                command = "SAVE",
                sessionToken = sessionToken,
                cardNumber = "4296005885355275",        // Test card number
                expirationDate = "12/2025",
                paymentSystem = 1,                     // Visa
                fiCode = 190,
                cardholderName = "David Caballero",
                cardholderIdType = "CC",
                cardholderId = "123456799",
                email = "david.caballero@ecollect.co",
                phone = "+1 311111111",
            )
        )
        cardToken = saveResponse.token
        println("Card saved! Token: $cardToken")
    } catch (e: EcollectException) {
        println("Could not save card: ${e.message}")
    }

    // --------------------------------------------------------
    // Step 4: List saved tokens for this customer
    // --------------------------------------------------------
    println("\n--- Step 4: List Saved Cards ---")
    try {
        val freshSession = client.getSessionToken()     // Always use a fresh token
        val queryResponse = client.queryToken(
            QueryTokenRequest(
                sessionToken = freshSession.sessionToken,
                cardholderId = "123456799",
                cardholderIdType = "CC",
            )
        )
        println("Found ${queryResponse.tokens.size} saved card(s):")
        for (card in queryResponse.tokens) {
            println("  **** **** **** ${card.lastFour}  (${card.paymentSystemName})")
        }
    } catch (e: EcollectException) {
        println("Could not list tokens: ${e.message}")
    }

    // --------------------------------------------------------
    // Step 5: Process a payment
    // --------------------------------------------------------
    println("\n--- Step 5: Process Payment ---")

    var transactionId: String? = null
    try {
        val paymentSession = client.getSessionToken()   // Fresh token for payment

        val paymentResponse = client.createTransactionPayment(
            CreateTransactionPaymentRequest(
                sessionToken = paymentSession.sessionToken,
                amount = 50000,                              // $500.00 COP
                currency = "COP",
                orderId = "ORDER-KOTLIN-001",
                description = "Test purchase via ecollect Kotlin SDK",
                token = cardToken ?: "DEMO_TOKEN",           // Use saved token
                cardholderId = "123456799",
                cardholderIdType = "CC",
                email = "david.caballero@ecollect.co",
                phone = "+1 311111111",
                ipAddress = "192.168.1.100",
            )
        )

        if (paymentResponse.approved) {
            println("PAYMENT APPROVED!")
            println("  Transaction ID: ${paymentResponse.transactionId}")
            println("  Authorization:  ${paymentResponse.authorizationCode}")
            transactionId = paymentResponse.transactionId
        } else {
            println("PAYMENT DECLINED: ${paymentResponse.responseMessage}")
        }

    } catch (e: EcollectException) {
        println("Payment error: ${e.message}")
    }

    // --------------------------------------------------------
    // Step 6: Check transaction status
    // --------------------------------------------------------
    if (transactionId != null) {
        println("\n--- Step 6: Check Transaction Status ---")
        try {
            val statusSession = client.getSessionToken()

            val statusResponse = client.getTransactionInformation(
                GetTransactionInformationRequest(
                    sessionToken = statusSession.sessionToken,
                    transactionId = transactionId,
                )
            )

            println("Status:   ${statusResponse.status}")
            println("Amount:   ${statusResponse.amount} ${statusResponse.currency}")
            println("Date:     ${statusResponse.transactionDate}")
        } catch (e: EcollectException) {
            println("Could not check status: ${e.message}")
        }
    }

    // --------------------------------------------------------
    // Done!
    // --------------------------------------------------------
    println("\n${"=".repeat(60)}")
    println("End-to-end example completed!")
    println("=".repeat(60))
    println("\nNext steps:")
    println("  1. Replace YOUR_API_KEY with real credentials")
    println("  2. Set testMode = false for production")
    println("  3. Use a ViewModel + StateFlow in your Android app")
    println("  4. Configure webhook URL in your ecollect dashboard")
}
```

### Android ViewModel Example

```kotlin
/**
 * Complete Android ViewModel + Fragment example
 * Shows a real-world pattern for processing payments in Android
 */

// --- PaymentViewModel.kt ---
@HiltViewModel
class PaymentViewModel @Inject constructor(
    private val client: EcollectClient
) : ViewModel() {

    sealed class UiState {
        object Idle : UiState()
        object Loading : UiState()
        data class Success(val transactionId: String, val authCode: String) : UiState()
        data class Declined(val reason: String) : UiState()
        data class Error(val message: String) : UiState()
    }

    private val _uiState = MutableStateFlow<UiState>(UiState.Idle)
    val uiState: StateFlow<UiState> = _uiState.asStateFlow()

    fun payWithToken(cardToken: String, amountCents: Int, orderId: String) {
        viewModelScope.launch {
            _uiState.value = UiState.Loading
            try {
                val session = client.getSessionToken()
                val response = client.createTransactionPayment(
                    CreateTransactionPaymentRequest(
                        sessionToken = session.sessionToken,
                        amount = amountCents,
                        currency = "COP",
                        orderId = orderId,
                        description = "App Purchase",
                        token = cardToken,
                        cardholderId = "123456799",
                        cardholderIdType = "CC",
                        email = "customer@example.com",
                        phone = "+1 311111111",
                        ipAddress = "0.0.0.0",
                    )
                )
                _uiState.value = if (response.approved) {
                    UiState.Success(response.transactionId, response.authorizationCode)
                } else {
                    UiState.Declined(response.responseMessage)
                }
            } catch (e: EcollectException) {
                _uiState.value = UiState.Error(e.message ?: "Unknown error")
            }
        }
    }
}

// --- CheckoutFragment.kt ---
@AndroidEntryPoint
class CheckoutFragment : Fragment(R.layout.fragment_checkout) {

    private val viewModel: PaymentViewModel by viewModels()

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)

        viewLifecycleOwner.lifecycleScope.launch {
            repeatOnLifecycle(Lifecycle.State.STARTED) {
                viewModel.uiState.collect { state ->
                    when (state) {
                        UiState.Idle     -> showPaymentForm()
                        UiState.Loading  -> showLoadingSpinner()
                        is UiState.Success  -> navigateToSuccess(state.transactionId)
                        is UiState.Declined -> showDeclinedMessage(state.reason)
                        is UiState.Error    -> showErrorMessage(state.message)
                    }
                }
            }
        }

        binding.btnPay.setOnClickListener {
            viewModel.payWithToken(
                cardToken = "SAVED_CARD_TOKEN",
                amountCents = 50000,
                orderId = "ORDER-${System.currentTimeMillis()}",
            )
        }
    }
}
```

---

## ⚠️ Common Errors

### `EcollectAuthException: Invalid API key`
**Cause:** Wrong API key or entity code.
**Fix:** Check both values in your ecollect dashboard. Make sure there are no spaces.

### `EcollectConnectionException`
**Cause:** No internet connection, or the `INTERNET` permission is missing from `AndroidManifest.xml`.
**Fix:** Add `<uses-permission android:name="android.permission.INTERNET" />` to your manifest.

### `NetworkOnMainThreadException`
**Cause:** You called an SDK method directly on the Android main thread without a coroutine.
**Fix:** Always wrap SDK calls in `viewModelScope.launch { }` or another coroutine scope.

### `EcollectValidationException: field 'cardNumber' is required`
**Cause:** A required field is missing from your request.
**Fix:** Check `e.field` to see which parameter is missing.

### `EcollectTimeoutException`
**Cause:** Slow network or unresponsive server.
**Fix:** Increase timeout: `EcollectConfig(..., timeoutSeconds = 60L)`.

### Build error: `Unresolved reference: EcollectClient`
**Cause:** The SDK dependency was not added correctly or Gradle hasn't synced.
**Fix:** Verify your `build.gradle.kts` dependency, then click **File → Sync Project with Gradle Files**.

---

## ❓ FAQ

**Q: Should I create one `EcollectClient` or multiple?**
A: Create one instance and reuse it. In Android, hold it in a `ViewModel` or inject it with Hilt as a `@Singleton`.

**Q: Is it safe to store card tokens in my database?**
A: Yes. Tokens are not card numbers. They are safe to store and do not require PCI compliance on your side.

**Q: My app crashes with `NetworkOnMainThreadException`. Help!**
A: You called a network method on the main thread. Always use `viewModelScope.launch { }` around SDK calls.

**Q: Can I use this SDK in a pure JVM backend (not Android)?**
A: Yes! Use `runBlocking { }` or any other coroutine scope in your backend code.

**Q: How do I handle the case where a payment times out — did the charge go through?**
A: After a timeout, call `getTransactionInformation` with your order ID to check before retrying. Do NOT retry a payment without checking first — you could double-charge the customer.

**Q: What currencies does ecollect support?**
A: Depends on your contract. Common: COP (Colombia), MXN (Mexico), PEN (Peru). Ask your ecollect account manager.

**Q: How do I test on a real Android device?**
A: Use `testMode = true` and the test card data in this guide. Make sure the device has internet access.

---

## 📞 Support

- **ecollect Merchant Dashboard:** [https://www.e-collect.com](https://www.e-collect.com)
- **SDK Issues:** Open an issue in the GitHub repository

---

*Build something great! Start in test mode, verify everything works, then flip `testMode = false` and go live.* 🚀
