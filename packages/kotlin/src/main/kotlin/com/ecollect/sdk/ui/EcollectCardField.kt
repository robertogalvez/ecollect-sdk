package com.ecollect.sdk.ui

/**
 * Placeholder for Android View / Jetpack Composable for secure card capture.
 *
 * In a real Android project this would extend android.view.View (or be a @Composable).
 * This file shows the intended interface for the UI component.
 *
 * Security model:
 *  - Card data (PAN, CVV, expiry) is captured in this isolated view
 *  - Data is sent DIRECTLY to the ecollect tokenization endpoint
 *  - The merchant app NEVER sees the raw PAN; it only receives a TokenId
 *
 * Usage:
 * ```kotlin
 * val cardField = EcollectCardField()
 * cardField.setSessionToken(sessionToken)
 * cardField.setEntityCode(entityCode)
 * cardField.setOnTokenReceived { tokenId ->
 *     // Send tokenId to your backend to complete the payment
 *     backend.processPayment(tokenId)
 * }
 * ```
 */
class EcollectCardField {
    private var onTokenReceived: ((tokenId: String) -> Unit)? = null
    private var sessionToken: String? = null
    private var entityCode: Int? = null
    private var paymentSystem: String? = null
    private var fiCode: String? = null

    /**
     * Set callback to receive the TokenId once tokenization is complete.
     * The merchant app should send this TokenId to their backend.
     */
    fun setOnTokenReceived(callback: (tokenId: String) -> Unit) {
        onTokenReceived = callback
    }

    /**
     * Set the session token (obtained from the merchant's backend).
     * The ApiKey should NEVER be stored on the device or passed here.
     */
    fun setSessionToken(sessionToken: String) {
        this.sessionToken = sessionToken
    }

    /**
     * Set the entity (merchant) code.
     */
    fun setEntityCode(entityCode: Int) {
        this.entityCode = entityCode
    }

    /**
     * Set the payment system code.
     */
    fun setPaymentSystem(paymentSystem: String) {
        this.paymentSystem = paymentSystem
    }

    /**
     * Set the financial institution code (e.g., VISA, MASTERCARD).
     */
    fun setFiCode(fiCode: String) {
        this.fiCode = fiCode
    }

    // In a real Android View, this would be triggered by user interaction
    // (e.g., a Submit button tap) and would call the ecollect tokenCommand API
    // with Command=SAVE or Command=GET, then invoke onTokenReceived with the result.
}
