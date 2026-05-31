# 🚀 ecollect Swift/iOS SDK — Complete Guide

Welcome to the **ecollect Swift SDK**! This guide is written for iOS developers of all experience levels. Whether you are new to payment integrations or an experienced developer, every step is explained in detail.

---

## 📋 Table of Contents

1. [What is ecollect?](#what-is-ecollect)
2. [Prerequisites](#prerequisites)
3. [Installation (Swift Package Manager)](#installation-swift-package-manager)
4. [Setup — EcollectClient Initialization](#setup--ecollectclient-initialization)
5. [async/await API](#asyncawait-api)
6. [Getting a Session Token](#getting-a-session-token)
7. [Saving a Card Token](#saving-a-card-token)
8. [Listing Saved Tokens](#listing-saved-tokens)
9. [Processing a Payment](#processing-a-payment)
10. [Getting Available Payment Systems](#getting-available-payment-systems)
11. [Checking Transaction Status](#checking-transaction-status)
12. [Error Handling](#error-handling)
13. [Test vs Production](#test-vs-production)
14. [SwiftUI Integration Example](#swiftui-integration-example)
15. [UIKit Integration Example](#uikit-integration-example)
16. [Full Working Example](#full-working-example)
17. [Common Errors](#common-errors)
18. [FAQ](#faq)

---

## 💡 What is ecollect?

**ecollect** is a Latin American payment gateway that allows your iOS application to:

- Accept credit and debit card payments (Visa, Mastercard, and more)
- Process bank transfers (PSE in Colombia, SPEI in Mexico, and others)
- Save card information securely using **tokens** (so customers don't type their card number every time)
- Check the status of past transactions
- Verify webhooks sent by ecollect to your server

The SDK is written in Swift and uses modern **async/await** for clean, readable asynchronous code.

> 🏦 **Where do I get my credentials?** Your **API Key** and **Entity Code** come from the ecollect merchant dashboard. Contact your ecollect account manager to get access.

---

## ✅ Prerequisites

| Requirement | Minimum Version | How to check |
|---|---|---|
| Xcode | 14.0 or higher | Xcode → About Xcode |
| iOS Deployment Target | iOS 15.0 | Project → Targets → General |
| macOS (development machine) | macOS 12 Monterey | Apple menu → About this Mac |
| Swift | 5.7 or higher | `swift --version` in Terminal |

> 💡 **Why iOS 15?** The SDK uses `async/await`, which requires iOS 15+. If you need to support iOS 13 or 14, you can wrap calls in `Task { }` but the deployment target must still be 15+ for async/await.

---

## 📦 Installation (Swift Package Manager)

Swift Package Manager (SPM) is the recommended way to add the ecollect SDK to your project. It is built into Xcode — no extra tools needed.

### Step-by-step instructions

**Step 1:** Open your project in Xcode.

**Step 2:** In the menu bar, go to **File → Add Package Dependencies...**
*(In older Xcode versions: File → Swift Packages → Add Package Dependency)*

**Step 3:** In the search field at the top right of the dialog, paste the repository URL:
```
https://github.com/ecollect/ecollect-swift-sdk
```
Then press **Enter** or click the search button.

**Step 4:** Xcode will find the package. You will see the package name and available versions.
- Under **Dependency Rule**, select **Up to Next Major Version**
- Set the minimum version to `1.0.0`

**Step 5:** Click **Add Package**.

**Step 6:** A second dialog asks which targets to add the library to. Select your app target (usually the one with your app's name) and click **Add Package**.

**Step 7:** Verify the installation by opening any Swift file and typing:
```swift
import EcollectSDK
```
If Xcode does not show an error, the installation was successful!

### Alternatively: Edit Package.swift directly (for frameworks/packages)

If your project is itself a Swift package, add the dependency to `Package.swift`:

```swift
// Package.swift
// swift-tools-version: 5.7

import PackageDescription

let package = Package(
    name: "YourApp",
    platforms: [
        .iOS(.v15),         // Minimum iOS 15 required
        .macOS(.v12),       // If you also support macOS
    ],
    dependencies: [
        // Add the ecollect SDK as a dependency
        .package(
            url: "https://github.com/ecollect/ecollect-swift-sdk",
            from: "1.0.0"
        ),
    ],
    targets: [
        .target(
            name: "YourApp",
            dependencies: [
                // Link the SDK to your target
                .product(name: "EcollectSDK", package: "ecollect-swift-sdk"),
            ]
        ),
    ]
)
```

---

## 🔧 Setup — EcollectClient Initialization

The `EcollectClient` is your main entry point for all ecollect API operations. Create it once and share it throughout your app.

```swift
import EcollectSDK

// Create the client with your credentials
let client = EcollectClient(
    apiKey: "YOUR_API_KEY_HERE",         // API key from your ecollect dashboard
    entityCode: "YOUR_ENTITY_CODE",      // Your entity code, e.g., "50039"
    testMode: true                       // true  = test environment (no real charges!)
                                         // false = production (real money!)
)
```

### All available options

```swift
import EcollectSDK

let client = EcollectClient(
    apiKey: "YOUR_API_KEY_HERE",         // Required: your API key
    entityCode: "YOUR_ENTITY_CODE",      // Required: your entity code
    testMode: true,                      // Optional: default is false (production)
    timeoutInterval: 30.0,               // Optional: network timeout seconds (default: 30)
    maxRetries: 3                        // Optional: retries on failure (default: 3)
)
```

### Where to put the client in your app

```swift
// Option 1: In your App entry point (SwiftUI)
@main
struct MyPaymentApp: App {
    // The client is created once and passed to views via environment
    let ecollectClient = EcollectClient(
        apiKey: "YOUR_API_KEY",
        entityCode: "50039",
        testMode: true
    )

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(ecollectClient)  // Inject into view hierarchy
        }
    }
}

// Option 2: In a singleton service class
class PaymentService {
    static let shared = PaymentService()  // Singleton — one instance for the whole app

    let client = EcollectClient(
        apiKey: "YOUR_API_KEY",
        entityCode: "50039",
        testMode: true
    )

    private init() {}  // Prevent external initialization
}
```

---

## ⚡ async/await API

All ecollect SDK methods are **async functions** — they must be called with `await` inside an `async` context (like a `Task` or another `async` function). This keeps your UI smooth and responsive.

### What is async/await?

```swift
// A regular function runs from start to finish without pausing
func regularFunction() {
    let result = someFastOperation()   // Returns immediately
    print(result)
}

// An async function can pause (await) without blocking the thread
func asyncFunction() async {
    let result = await someNetworkCall()   // Pauses here, allows UI to stay responsive
    print(result)
}
```

### Calling async functions from a button tap or lifecycle event

```swift
// In SwiftUI — use Task { } to start an async context
Button("Pay Now") {
    Task {
        do {
            let session = try await client.getSessionToken()
            print(session.sessionToken)
        } catch {
            print("Error: \(error)")
        }
    }
}

// In UIKit — use Task { } in a button action
@IBAction func payButtonTapped(_ sender: UIButton) {
    Task {
        do {
            let session = try await client.getSessionToken()
            print(session.sessionToken)
        } catch {
            print("Error: \(error)")
        }
    }
}
```

---

## 🔑 Getting a Session Token

Before most API calls, you need a **session token** — a temporary credential proving you are authorized. Always get a fresh one before important operations.

```swift
import EcollectSDK

let client = EcollectClient(
    apiKey: "YOUR_API_KEY",
    entityCode: "50039",
    testMode: true
)

// Must be called from an async context (Task, async function, etc.)
Task {
    do {
        // Request a session token
        let response = try await client.getSessionToken()

        // The response contains the token and when it expires
        print("Session token: \(response.sessionToken)")
        print("Expires at:    \(response.expiresAt)")
        print("Status:        \(response.status)")

    } catch {
        print("Failed to get session token: \(error)")
    }
}
```

### Response fields

| Field | Type | Description |
|---|---|---|
| `sessionToken` | `String` | Token to use in subsequent requests |
| `expiresAt` | `Date` | When this token expires |
| `status` | `String` | `"SUCCESS"` if everything worked |

---

## 💳 Saving a Card Token

Card **tokenization** lets you save a customer's card safely. ecollect stores the actual card data and returns a **token** — a safe reference you can store in your database and reuse for future payments.

```swift
import EcollectSDK

let client = EcollectClient(apiKey: "YOUR_API_KEY", entityCode: "50039", testMode: true)

Task {
    do {
        // Step 1: Get a session token — required before any API call
        let session = try await client.getSessionToken()

        // Step 2: Build the save card request
        let request = TokenCommandRequest(
            command: "SAVE",                            // Tell ecollect to SAVE a new card
            sessionToken: session.sessionToken,          // The session token we just got
            cardNumber: "4296005885355275",              // Customer's card number
            expirationDate: "12/2025",                  // Expiry date: MM/YYYY
            paymentSystem: 1,                           // 1 = Visa
            fiCode: 190,                                // Financial institution code
            cardholderName: "David Caballero",          // Name as printed on the card
            cardholderIdType: "CC",                     // CC = Colombian Cédula
            cardholderId: "123456799",                  // Customer's national ID
            email: "david.caballero@ecollect.co",       // Customer email
            phone: "+1 311111111"                       // Customer phone
        )

        // Step 3: Execute the command
        let response = try await client.tokenCommand(request)

        // Step 4: Save response.token — you'll need it for future payments!
        print("Card saved! Token: \(response.token)")
        print("Status: \(response.status)")

    } catch {
        print("Error saving card: \(error)")
    }
}
```

### Other token commands

| Command | Description |
|---|---|
| `SAVE` | Save a new card and receive a reusable token |
| `GET` | Retrieve masked card details by token |
| `REMOVE` | Delete a saved card token permanently |
| `UPDATE` | Update card details (e.g., new expiry date) |
| `HOLD` | Temporarily freeze a card token |

#### GET — Retrieve a saved card

```swift
let request = TokenCommandRequest(
    command: "GET",
    sessionToken: session.sessionToken,   // Active session token
    token: "CARD_TOKEN_HERE"              // Token you saved earlier
)

let response = try await client.tokenCommand(request)
print("Cardholder: \(response.cardholderName)")
print("Last 4: \(response.lastFour)")         // e.g., "5275"
print("Expires: \(response.expirationDate)")
```

#### REMOVE — Delete a saved card

```swift
let request = TokenCommandRequest(
    command: "REMOVE",
    sessionToken: session.sessionToken,
    token: "CARD_TOKEN_HERE"
)

let response = try await client.tokenCommand(request)
print("Card removed: \(response.status)")
```

---

## 📋 Listing Saved Tokens

Use `queryToken` to retrieve all cards saved for a customer. Use this to build a "Saved payment methods" screen.

```swift
import EcollectSDK

Task {
    do {
        // Get a fresh session token
        let session = try await client.getSessionToken()

        // Build the query request
        let request = QueryTokenRequest(
            sessionToken: session.sessionToken,  // Active session token
            cardholderId: "123456799",           // Customer's national ID
            cardholderIdType: "CC"               // ID type
        )

        // Execute the query
        let response = try await client.queryToken(request)

        // Display all saved cards
        print("Found \(response.tokens.count) saved card(s):")
        for card in response.tokens {
            print("  Token:   \(card.token)")
            print("  Card:    **** **** **** \(card.lastFour)")
            print("  Type:    \(card.paymentSystemName)")  // e.g., "Visa"
            print("  Expires: \(card.expirationDate)")
            print()
        }

    } catch {
        print("Error listing tokens: \(error)")
    }
}
```

---

## 💰 Processing a Payment

The `createTransactionPayment` method charges a customer. You can pay using:
1. A **card token** (saved previously — best for returning customers)
2. **Card details directly** (for one-time payments)

### Payment with a saved token

```swift
import EcollectSDK

Task {
    do {
        // Always get a fresh session token before a payment
        let session = try await client.getSessionToken()

        // Build the payment request
        let request = CreateTransactionPaymentRequest(
            sessionToken: session.sessionToken,       // Active session token
            amount: 50000,                            // Amount in smallest currency unit
                                                      // 50000 = $500.00 COP
            currency: "COP",                          // Currency: COP, MXN, PEN, etc.
            orderId: "ORDER-001",                     // YOUR unique order reference
            description: "Purchase at My Store",     // Human-readable description
            token: "CARD_TOKEN_HERE",                // Token from a previously saved card
            cardholderId: "123456799",               // Customer's national ID
            cardholderIdType: "CC",                  // ID type
            email: "david.caballero@ecollect.co",    // Customer email (for receipt)
            phone: "+1 311111111",                   // Customer phone
            ipAddress: "192.168.1.1"                 // Customer's IP address
        )

        // Execute the payment
        let response = try await client.createTransactionPayment(request)

        if response.approved {
            print("✅ Payment APPROVED!")
            print("Transaction ID: \(response.transactionId)")    // SAVE THIS!
            print("Authorization:  \(response.authorizationCode)")
        } else {
            print("❌ Payment DECLINED")
            print("Reason: \(response.responseMessage)")
            print("Code:   \(response.responseCode)")
        }

    } catch {
        print("Payment error: \(error)")
    }
}
```

### Payment with card details directly

```swift
let request = CreateTransactionPaymentRequest(
    sessionToken: session.sessionToken,
    amount: 50000,
    currency: "COP",
    orderId: "ORDER-002",
    description: "One-time purchase",
    // Card details instead of a token
    cardNumber: "4296005885355275",
    expirationDate: "12/2025",
    paymentSystem: 1,                    // 1 = Visa
    fiCode: 190,
    cardholderName: "David Caballero",
    cardholderId: "123456799",
    cardholderIdType: "CC",
    email: "david.caballero@ecollect.co",
    phone: "+1 311111111",
    ipAddress: "192.168.1.1"
)

let response = try await client.createTransactionPayment(request)
print("Approved: \(response.approved)")
```

---

## 🏦 Getting Available Payment Systems

Use `getPaymentSystem` to list all payment methods enabled for your account.

```swift
import EcollectSDK

Task {
    do {
        let session = try await client.getSessionToken()

        let request = GetPaymentSystemRequest(
            sessionToken: session.sessionToken
        )

        let response = try await client.getPaymentSystem(request)

        print("Available payment methods:")
        for method in response.paymentSystems {
            print("  [\(method.paymentSystemId)] \(method.name)")
            // Example output:
            // [1] Visa
            // [2] Mastercard
            // [5] PSE
        }

    } catch {
        print("Error: \(error)")
    }
}
```

---

## 🔍 Checking Transaction Status

Use `getTransactionInformation` to look up a transaction's current state.

> 📌 **Note:** In production, this uses a special URL. The SDK handles it automatically.

```swift
import EcollectSDK

Task {
    do {
        let session = try await client.getSessionToken()

        let request = GetTransactionInformationRequest(
            sessionToken: session.sessionToken,
            transactionId: "TRANSACTION_ID_HERE"   // ID from the original payment
        )

        let response = try await client.getTransactionInformation(request)

        print("Status:        \(response.status)")          // APPROVED, DECLINED, PENDING
        print("Amount:        \(response.amount)")
        print("Currency:      \(response.currency)")
        print("Date:          \(response.transactionDate)")
        print("Authorization: \(response.authorizationCode)")

    } catch {
        print("Error: \(error)")
    }
}
```

---

## ❌ Error Handling

The SDK uses a typed `EcollectError` enum so you can `switch` on each error case.

### The `EcollectError` enum

```swift
public enum EcollectError: Error {
    case authenticationFailed(String)    // Wrong API key or entity code
    case connectionFailed(String)        // Cannot reach the ecollect server
    case requestTimeout                  // Request exceeded the timeout
    case validationError(field: String, message: String)  // Invalid request parameter
    case apiError(code: String, message: String)          // Business logic error from API
    case unknown(Error)                  // Unexpected error
}
```

### Comprehensive error handling

```swift
import EcollectSDK

Task {
    do {
        let session = try await client.getSessionToken()

        let request = CreateTransactionPaymentRequest(
            sessionToken: session.sessionToken,
            amount: 50000,
            currency: "COP",
            orderId: "ORDER-005",
            description: "Test",
            token: "CARD_TOKEN_HERE",
            cardholderId: "123456799",
            cardholderIdType: "CC",
            email: "customer@example.com",
            phone: "+1 311111111",
            ipAddress: "192.168.1.1"
        )

        let response = try await client.createTransactionPayment(request)
        print("Result: \(response.responseMessage)")

    } catch let error as EcollectError {
        // Switch on the specific error type
        switch error {
        case .authenticationFailed(let message):
            // Your API key or entity code is wrong
            print("Auth failed: \(message)")
            print("Action: Check your credentials in the ecollect dashboard.")

        case .connectionFailed(let message):
            // Cannot reach the ecollect server
            print("Connection failed: \(message)")
            print("Action: Check internet connection.")

        case .requestTimeout:
            // Request took too long
            print("Request timed out.")
            print("Action: Retry, or check transaction status before retrying.")

        case .validationError(let field, let message):
            // Invalid or missing request parameter
            print("Validation error on '\(field)': \(message)")
            print("Action: Fix the highlighted field in your request.")

        case .apiError(let code, let message):
            // Business error (e.g., card declined, insufficient funds)
            print("API error [\(code)]: \(message)")

        case .unknown(let underlying):
            // Something unexpected happened
            print("Unexpected error: \(underlying)")
        }

    } catch {
        // Non-ecollect errors (programming bugs, etc.)
        print("Non-ecollect error: \(error)")
    }
}
```

---

## 🌍 Test vs Production

### Using the test environment

```swift
// TEST MODE — safe sandbox, no real money
let client = EcollectClient(
    apiKey: "YOUR_TEST_API_KEY",
    entityCode: "50039",
    testMode: true   // ← Test mode activated
)
```

### Switching to production

```swift
// PRODUCTION — real transactions!
let client = EcollectClient(
    apiKey: "YOUR_PRODUCTION_API_KEY",
    entityCode: "YOUR_PRODUCTION_ENTITY_CODE",
    testMode: false   // ← Production mode
)
```

### Best practice: Use environment-based configuration

Never hardcode credentials in your source code. Use a configuration file or environment variables:

```swift
// Config.swift — keep secrets out of source code
// Load from environment or secure storage (Keychain for production apps)

enum EcollectConfig {
    #if DEBUG
    // Debug build — use test credentials
    static let apiKey = "YOUR_TEST_API_KEY"
    static let entityCode = "50039"
    static let testMode = true
    #else
    // Release build — use production credentials
    // In a real app, load these from Keychain or a secure config server
    static let apiKey = ProcessInfo.processInfo.environment["ECOLLECT_API_KEY"] ?? ""
    static let entityCode = ProcessInfo.processInfo.environment["ECOLLECT_ENTITY_CODE"] ?? ""
    static let testMode = false
    #endif
}

// Use it:
let client = EcollectClient(
    apiKey: EcollectConfig.apiKey,
    entityCode: EcollectConfig.entityCode,
    testMode: EcollectConfig.testMode
)
```

### Test card data

Use these details when `testMode: true` to simulate payments:

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

## 🎨 SwiftUI Integration Example

Here is a complete SwiftUI checkout view using the ecollect SDK.

```swift
import SwiftUI
import EcollectSDK

// MARK: - ViewModel

@MainActor  // All UI updates happen on the main thread
class CheckoutViewModel: ObservableObject {

    // Published properties trigger SwiftUI view updates automatically
    @Published var isLoading = false
    @Published var paymentResult: String?
    @Published var errorMessage: String?
    @Published var showError = false

    // The ecollect client (injected or created here)
    private let client: EcollectClient

    init(client: EcollectClient) {
        self.client = client
    }

    // Called when user taps "Pay"
    func processPayment(cardToken: String, amount: Int) {
        isLoading = true
        paymentResult = nil
        errorMessage = nil

        Task {
            do {
                // Get a fresh session token
                let session = try await client.getSessionToken()

                // Build and execute the payment request
                let response = try await client.createTransactionPayment(
                    CreateTransactionPaymentRequest(
                        sessionToken: session.sessionToken,
                        amount: amount,
                        currency: "COP",
                        orderId: "ORDER-\(UUID().uuidString.prefix(8))",
                        description: "App Purchase",
                        token: cardToken,
                        cardholderId: "123456799",
                        cardholderIdType: "CC",
                        email: "customer@example.com",
                        phone: "+1 311111111",
                        ipAddress: "0.0.0.0"   // Use real IP in production
                    )
                )

                isLoading = false

                if response.approved {
                    paymentResult = "✅ Approved! ID: \(response.transactionId)"
                } else {
                    paymentResult = "❌ Declined: \(response.responseMessage)"
                }

            } catch let error as EcollectError {
                isLoading = false
                errorMessage = error.localizedDescription
                showError = true
            } catch {
                isLoading = false
                errorMessage = error.localizedDescription
                showError = true
            }
        }
    }
}

// MARK: - SwiftUI View

struct CheckoutView: View {
    // Environment object — injected from the parent or app entry point
    @EnvironmentObject var ecollectClient: EcollectClient

    // ViewModel owned by this view
    @StateObject private var viewModel: CheckoutViewModel

    // The saved card token (in a real app, loaded from your backend or Keychain)
    let savedCardToken = "YOUR_SAVED_CARD_TOKEN"

    init() {
        // Note: In a real app you would inject the client properly
        _viewModel = StateObject(wrappedValue: CheckoutViewModel(
            client: EcollectClient(apiKey: "YOUR_KEY", entityCode: "50039", testMode: true)
        ))
    }

    var body: some View {
        VStack(spacing: 24) {

            Text("Checkout")
                .font(.largeTitle)
                .fontWeight(.bold)

            // Order summary
            VStack(alignment: .leading, spacing: 8) {
                Text("Order Summary")
                    .font(.headline)
                HStack {
                    Text("Total")
                    Spacer()
                    Text("$500.00 COP")
                        .fontWeight(.semibold)
                }
            }
            .padding()
            .background(Color(.systemGray6))
            .cornerRadius(12)

            // Card display (using saved token)
            HStack {
                Image(systemName: "creditcard.fill")
                    .foregroundColor(.blue)
                Text("Visa **** 5275")
                Spacer()
                Text("Saved card")
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
            .padding()
            .background(Color(.systemGray6))
            .cornerRadius(12)

            // Payment result message
            if let result = viewModel.paymentResult {
                Text(result)
                    .font(.subheadline)
                    .multilineTextAlignment(.center)
                    .padding()
                    .background(
                        result.contains("✅") ? Color.green.opacity(0.1) : Color.red.opacity(0.1)
                    )
                    .cornerRadius(8)
            }

            // Pay button
            Button(action: {
                viewModel.processPayment(cardToken: savedCardToken, amount: 50000)
            }) {
                HStack {
                    if viewModel.isLoading {
                        ProgressView()       // Spinner while loading
                            .tint(.white)
                    } else {
                        Image(systemName: "lock.fill")
                    }
                    Text(viewModel.isLoading ? "Processing..." : "Pay $500.00 COP")
                        .fontWeight(.semibold)
                }
                .frame(maxWidth: .infinity)
                .padding()
                .background(viewModel.isLoading ? Color.gray : Color.blue)
                .foregroundColor(.white)
                .cornerRadius(12)
            }
            .disabled(viewModel.isLoading)

            Spacer()
        }
        .padding()
        // Error alert
        .alert("Payment Error", isPresented: $viewModel.showError) {
            Button("OK", role: .cancel) {}
        } message: {
            Text(viewModel.errorMessage ?? "Unknown error occurred")
        }
    }
}

// MARK: - Preview
#Preview {
    CheckoutView()
}
```

---

## 📱 UIKit Integration Example

Here is how to use the SDK in a UIKit view controller.

```swift
import UIKit
import EcollectSDK

class CheckoutViewController: UIViewController {

    // UI elements (connected via Interface Builder or created programmatically)
    @IBOutlet weak var payButton: UIButton!
    @IBOutlet weak var activityIndicator: UIActivityIndicatorView!
    @IBOutlet weak var statusLabel: UILabel!

    // ecollect client — in a real app, inject this via initializer or property
    private let client = EcollectClient(
        apiKey: "YOUR_API_KEY",
        entityCode: "50039",
        testMode: true
    )

    override func viewDidLoad() {
        super.viewDidLoad()
        statusLabel.text = "Ready to pay"
        activityIndicator.hidesWhenStopped = true
    }

    @IBAction func payButtonTapped(_ sender: UIButton) {
        // Start a Task to run async code
        Task {
            await processPayment()
        }
    }

    // Mark as @MainActor so UI updates happen on the main thread
    @MainActor
    private func processPayment() async {
        // Show loading state
        payButton.isEnabled = false
        activityIndicator.startAnimating()
        statusLabel.text = "Processing..."

        do {
            // Step 1: Get a fresh session token
            let session = try await client.getSessionToken()

            // Step 2: Execute the payment
            let response = try await client.createTransactionPayment(
                CreateTransactionPaymentRequest(
                    sessionToken: session.sessionToken,
                    amount: 50000,
                    currency: "COP",
                    orderId: "ORDER-UIK-001",
                    description: "Purchase",
                    token: "SAVED_CARD_TOKEN",
                    cardholderId: "123456799",
                    cardholderIdType: "CC",
                    email: "customer@example.com",
                    phone: "+1 311111111",
                    ipAddress: "0.0.0.0"
                )
            )

            // Update UI with result
            activityIndicator.stopAnimating()
            payButton.isEnabled = true

            if response.approved {
                statusLabel.text = "✅ Payment approved!\nID: \(response.transactionId)"
                statusLabel.textColor = .systemGreen
                // Navigate to success screen
                showSuccessAlert(transactionId: response.transactionId)
            } else {
                statusLabel.text = "❌ Declined: \(response.responseMessage)"
                statusLabel.textColor = .systemRed
            }

        } catch let error as EcollectError {
            activityIndicator.stopAnimating()
            payButton.isEnabled = true

            switch error {
            case .connectionFailed:
                showErrorAlert("No internet connection. Please try again.")
            case .requestTimeout:
                showErrorAlert("Request timed out. Please try again.")
            case .authenticationFailed(let msg):
                showErrorAlert("Authentication failed: \(msg)")
            default:
                showErrorAlert("Payment error: \(error.localizedDescription)")
            }
        } catch {
            activityIndicator.stopAnimating()
            payButton.isEnabled = true
            showErrorAlert("Unexpected error: \(error.localizedDescription)")
        }
    }

    private func showSuccessAlert(transactionId: String) {
        let alert = UIAlertController(
            title: "Payment Successful",
            message: "Transaction ID: \(transactionId)\n\nYour order is confirmed!",
            preferredStyle: .alert
        )
        alert.addAction(UIAlertAction(title: "OK", style: .default) { _ in
            // Navigate to order confirmation screen
        })
        present(alert, animated: true)
    }

    private func showErrorAlert(_ message: String) {
        let alert = UIAlertController(
            title: "Payment Failed",
            message: message,
            preferredStyle: .alert
        )
        alert.addAction(UIAlertAction(title: "OK", style: .default))
        present(alert, animated: true)
    }
}
```

---

## 🎯 Full Working Example

This is a complete, runnable Swift file demonstrating every SDK feature.

```swift
/**
 * ecollect Swift SDK — Full End-to-End Example
 *
 * This file demonstrates the complete payment flow:
 *  1. Initialize the client
 *  2. Get a session token
 *  3. List available payment methods
 *  4. Save a card token
 *  5. List saved tokens for the customer
 *  6. Process a payment using the saved token
 *  7. Check the transaction status
 *
 * How to run: Add this to a Swift Playground or a new Swift file in your project.
 */

import Foundation
import EcollectSDK

// ============================================================
// STEP 0: Initialize the client
// ============================================================
print("========================================")
print("ecollect Swift SDK — Full Example")
print("========================================")

let client = EcollectClient(
    apiKey: "YOUR_API_KEY",      // ← Replace with your API key
    entityCode: "50039",          // ← Replace with your entity code
    testMode: true               // Test mode: no real charges!
)

print("Client initialized in TEST mode")

// All the action happens in this async Task
Task {
    // --------------------------------------------------------
    // STEP 1: Get a session token
    // --------------------------------------------------------
    print("\n--- Step 1: Get Session Token ---")

    guard let session = try? await client.getSessionToken() else {
        print("FAILED to get session token. Check your API key and internet connection.")
        return
    }

    let sessionToken = session.sessionToken
    print("Token obtained: \(String(sessionToken.prefix(20)))...")

    // --------------------------------------------------------
    // STEP 2: List available payment methods
    // --------------------------------------------------------
    print("\n--- Step 2: Available Payment Methods ---")

    do {
        let psResponse = try await client.getPaymentSystem(
            GetPaymentSystemRequest(sessionToken: sessionToken)
        )
        for method in psResponse.paymentSystems {
            print("  [\(method.paymentSystemId)] \(method.name)")
        }
    } catch {
        print("Could not fetch payment methods: \(error)")
    }

    // --------------------------------------------------------
    // STEP 3: Save a card token
    // --------------------------------------------------------
    print("\n--- Step 3: Save Card Token ---")

    var cardToken: String? = nil
    do {
        let saveResponse = try await client.tokenCommand(
            TokenCommandRequest(
                command: "SAVE",
                sessionToken: sessionToken,
                cardNumber: "4296005885355275",       // Test card number
                expirationDate: "12/2025",
                paymentSystem: 1,                    // Visa
                fiCode: 190,
                cardholderName: "David Caballero",
                cardholderIdType: "CC",
                cardholderId: "123456799",
                email: "david.caballero@ecollect.co",
                phone: "+1 311111111"
            )
        )
        cardToken = saveResponse.token
        print("Card saved! Token: \(saveResponse.token)")
    } catch {
        print("Could not save card: \(error)")
    }

    // --------------------------------------------------------
    // STEP 4: List saved tokens for this customer
    // --------------------------------------------------------
    print("\n--- Step 4: List Saved Cards ---")

    do {
        // Always use a fresh session token
        let freshSession = try await client.getSessionToken()
        let queryResponse = try await client.queryToken(
            QueryTokenRequest(
                sessionToken: freshSession.sessionToken,
                cardholderId: "123456799",
                cardholderIdType: "CC"
            )
        )
        print("Found \(queryResponse.tokens.count) saved card(s):")
        for card in queryResponse.tokens {
            print("  **** **** **** \(card.lastFour)  (\(card.paymentSystemName))")
        }
    } catch {
        print("Could not list tokens: \(error)")
    }

    // --------------------------------------------------------
    // STEP 5: Process a payment
    // --------------------------------------------------------
    print("\n--- Step 5: Process Payment ---")

    var transactionId: String? = nil
    do {
        let paymentSession = try await client.getSessionToken()  // Fresh token

        let paymentResponse = try await client.createTransactionPayment(
            CreateTransactionPaymentRequest(
                sessionToken: paymentSession.sessionToken,
                amount: 50000,                              // $500.00 COP
                currency: "COP",
                orderId: "ORDER-SWIFT-001",
                description: "Test purchase via ecollect Swift SDK",
                token: cardToken ?? "DEMO_TOKEN",           // Token from step 3
                cardholderId: "123456799",
                cardholderIdType: "CC",
                email: "david.caballero@ecollect.co",
                phone: "+1 311111111",
                ipAddress: "192.168.1.100"
            )
        )

        if paymentResponse.approved {
            print("PAYMENT APPROVED!")
            print("  Transaction ID: \(paymentResponse.transactionId)")
            print("  Authorization:  \(paymentResponse.authorizationCode)")
            transactionId = paymentResponse.transactionId
        } else {
            print("PAYMENT DECLINED: \(paymentResponse.responseMessage)")
        }

    } catch let error as EcollectError {
        print("Payment error: \(error)")
    }

    // --------------------------------------------------------
    // STEP 6: Check transaction status
    // --------------------------------------------------------
    if let txId = transactionId {
        print("\n--- Step 6: Check Transaction Status ---")

        do {
            let statusSession = try await client.getSessionToken()

            let statusResponse = try await client.getTransactionInformation(
                GetTransactionInformationRequest(
                    sessionToken: statusSession.sessionToken,
                    transactionId: txId
                )
            )

            print("Status:   \(statusResponse.status)")
            print("Amount:   \(statusResponse.amount) \(statusResponse.currency)")
            print("Date:     \(statusResponse.transactionDate)")
        } catch {
            print("Could not check status: \(error)")
        }
    }

    // --------------------------------------------------------
    // Done!
    // --------------------------------------------------------
    print("\n========================================")
    print("End-to-end example completed!")
    print("========================================")
    print("\nNext steps:")
    print("  1. Replace YOUR_API_KEY with real credentials")
    print("  2. Set testMode: false for production")
    print("  3. Use a ViewModel + @Published for SwiftUI")
    print("  4. Configure webhook URL in your ecollect dashboard")
}

// Keep the process alive for the async Task to complete (in command-line tools)
RunLoop.main.run(until: Date(timeIntervalSinceNow: 15))
```

---

## ⚠️ Common Errors

### `EcollectError.authenticationFailed`
**Cause:** Wrong API key or entity code.
**Fix:** Log in to your ecollect merchant dashboard and copy the credentials again carefully.

### `EcollectError.connectionFailed`
**Cause:** No internet, or `NSAppTransportSecurity` is blocking the request.
**Fix:** Make sure your device/simulator has internet. In `Info.plist`, check ATS settings for the ecollect domain.

### `EcollectError.requestTimeout`
**Cause:** Slow network or unresponsive server.
**Fix:** Increase timeout: `EcollectClient(..., timeoutInterval: 60.0)`. Check the server status.

### `EcollectError.validationError`
**Cause:** A required field is missing or has an invalid format.
**Fix:** Check the `field` value in the error to see exactly what is missing.

### Build error: `Cannot find type 'EcollectClient' in scope`
**Cause:** The SDK was not added correctly or the import is missing.
**Fix:** Verify the Swift Package Manager dependency is present in Xcode and that you have `import EcollectSDK` at the top of your file.

### Warning: `Non-sendable type 'EcollectClient' passed in implicitly`
**Cause:** You are using the client from multiple concurrency contexts.
**Fix:** Annotate your ViewModel with `@MainActor` or ensure you access the client from the same actor.

---

## ❓ FAQ

**Q: Can I use this SDK on macOS or tvOS as well?**
A: The SDK supports iOS 15+ and macOS 12+. tvOS support may vary — check the package documentation.

**Q: Is it safe to store card tokens in my database?**
A: Yes. Tokens are not card numbers. They are safe references that only ecollect can resolve. No PCI compliance required on your side.

**Q: Where should I initialize `EcollectClient` in a SwiftUI app?**
A: Best options: (1) In your `@main App` struct and inject via `.environmentObject()`, or (2) In a `@StateObject` ViewModel.

**Q: How do I avoid creating the client on every view creation?**
A: Use `@StateObject` (not `@ObservedObject`) in SwiftUI, or a singleton service class. `@StateObject` creates the object only once per view lifecycle.

**Q: My payment timed out — did the charge go through?**
A: After a timeout, always call `getTransactionInformation` before retrying the payment. Never retry blindly — you could double-charge the customer.

**Q: Can I process PSE (Colombian bank transfer) payments?**
A: Yes, if PSE is enabled on your ecollect account. Use `getPaymentSystem` to see which methods are available, then pass the PSE payment system ID in your payment request.

**Q: How do I test on a real iPhone?**
A: Connect your iPhone to your Mac, select it as the build target in Xcode, and run. Make sure the device has an internet connection and you are using `testMode: true`.

---

## 📞 Support

- **ecollect Merchant Dashboard:** [https://www.e-collect.com](https://www.e-collect.com)
- **SDK Issues:** Open an issue in the GitHub repository

---

*You are almost there! Test everything in test mode first — the worst thing that can happen there is a declined test transaction. Once you are confident, set `testMode: false` and ship it!* 🚀
