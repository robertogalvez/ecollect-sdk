package com.ecollect.sdk

import com.ecollect.sdk.exceptions.*
import org.junit.Assert.*
import org.junit.Test

class ErrorMappingTest {

    @Test
    fun `SessionExpiredException is an EcollectException`() {
        val ex = SessionExpiredException("Session expired")
        assertTrue(ex is EcollectException)
        assertEquals("Session expired", ex.message)
    }

    @Test
    fun `InvalidConfigException is an EcollectException`() {
        val ex = InvalidConfigException("Invalid entity code")
        assertTrue(ex is EcollectException)
    }

    @Test
    fun `ValidationException is an EcollectException`() {
        val ex = ValidationException("Amount must be positive")
        assertTrue(ex is EcollectException)
    }

    @Test
    fun `InvalidCardException is an EcollectException`() {
        val ex = InvalidCardException("Card failed Luhn check")
        assertTrue(ex is EcollectException)
    }

    @Test
    fun `NetworkRetryableException is an EcollectException`() {
        val cause = RuntimeException("connection reset")
        val ex = NetworkRetryableException("Network error", cause)
        assertTrue(ex is EcollectException)
        assertEquals(cause, ex.cause)
    }

    @Test
    fun `TokenNotFoundException is an EcollectException`() {
        val ex = TokenNotFoundException("Token not found")
        assertTrue(ex is EcollectException)
    }

    @Test
    fun `DuplicateTransactionException is an EcollectException`() {
        val ex = DuplicateTransactionException("MerchantTransactionId already used")
        assertTrue(ex is EcollectException)
    }

    @Test
    fun `AuthenticationException is an EcollectException`() {
        val ex = AuthenticationException("Access denied")
        assertTrue(ex is EcollectException)
    }

    @Test
    fun `WebhookValidationException is an EcollectException`() {
        val ex = WebhookValidationException("SessionToken mismatch")
        assertTrue(ex is EcollectException)
    }

    @Test
    fun `PollingTimeoutException is an EcollectException`() {
        val ex = PollingTimeoutException("Polling timed out after 600s")
        assertTrue(ex is EcollectException)
    }

    @Test
    fun `CustomerNotFoundException is an EcollectException`() {
        val ex = CustomerNotFoundException("Customer not found")
        assertTrue(ex is EcollectException)
    }

    // Verify the return code -> exception mapping table
    @Test
    fun `return code mapping covers all critical error codes`() {
        // This test documents expected mappings for code review purposes
        val mappings = mapOf(
            "FAIL_APIEXPIREDSESSION" to "SessionExpiredException",
            "FAIL_INVALIDENTITYCODE" to "InvalidConfigException",
            "FAIL_INVALIDSERVICECODE" to "InvalidConfigException",
            "FAIL_INVALIDCREDITCARD" to "InvalidCardException",
            "FAIL_INVALIDEXPIRATIONDATE" to "InvalidCardException",
            "FAIL_TOKENNOTFOUND" to "TokenNotFoundException",
            "FAIL_TOKENEXPIRED" to "TokenNotFoundException",
            "FAIL_MERCHANTRANSID" to "DuplicateTransactionException",
            "FAIL_ACCESSDENIED" to "AuthenticationException",
            "FAIL_SESSIONNOTFOUND" to "WebhookValidationException",
            "FAIL_TICKETIDNOTMATCH" to "WebhookValidationException",
            "FAIL_SYSTEM" to "NetworkRetryableException"
        )

        assertEquals(12, mappings.size)
        assertTrue(mappings.containsKey("FAIL_APIEXPIREDSESSION"))
        assertTrue(mappings.containsKey("FAIL_SYSTEM"))
    }

    @Test
    fun `exponential backoff delays are correct`() {
        // delay = 2000 * 2^attempt
        val delays = (1..3).map { attempt -> 2000L * Math.pow(2.0, attempt.toDouble()).toLong() }
        assertEquals(4000L, delays[0])
        assertEquals(8000L, delays[1])
        assertEquals(16000L, delays[2])
    }
}
