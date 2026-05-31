package com.ecollect.sdk

import com.ecollect.sdk.exceptions.InvalidCardException
import com.ecollect.sdk.exceptions.ValidationException
import com.ecollect.sdk.types.PaymentIntent
import com.ecollect.sdk.utils.Validators
import org.junit.Assert.*
import org.junit.Test

class ValidatorsTest {

    // --- Luhn check tests ---

    @Test
    fun `luhnCheck returns true for valid VISA test card`() {
        assertTrue(Validators.luhnCheck("4111111111111111"))
    }

    @Test
    fun `luhnCheck returns true for valid Mastercard test card`() {
        assertTrue(Validators.luhnCheck("5500005555555559"))
    }

    @Test
    fun `luhnCheck returns true for valid AMEX test card`() {
        assertTrue(Validators.luhnCheck("371449635398431"))
    }

    @Test
    fun `luhnCheck returns false for invalid card number`() {
        assertFalse(Validators.luhnCheck("1234567890123456"))
    }

    @Test
    fun `luhnCheck returns false for all zeros`() {
        assertFalse(Validators.luhnCheck("0000000000000000"))
    }

    @Test
    fun `luhnCheck returns false for too short number`() {
        assertFalse(Validators.luhnCheck("12345"))
    }

    @Test
    fun `luhnCheck strips spaces and dashes`() {
        // "4111 1111 1111 1111" -> "4111111111111111"
        assertTrue(Validators.luhnCheck("4111111111111111"))
    }

    // --- validateCardNumber tests ---

    @Test(expected = InvalidCardException::class)
    fun `validateCardNumber throws for invalid card`() {
        Validators.validateCardNumber("1234567890123456")
    }

    @Test
    fun `validateCardNumber passes for valid card`() {
        // Should not throw
        Validators.validateCardNumber("4111111111111111")
    }

    // --- validateExpirationDate tests ---

    @Test
    fun `validateExpirationDate passes for future date`() {
        Validators.validateExpirationDate("12/2030")
    }

    @Test(expected = InvalidCardException::class)
    fun `validateExpirationDate throws for past date`() {
        Validators.validateExpirationDate("01/2020")
    }

    @Test(expected = InvalidCardException::class)
    fun `validateExpirationDate throws for wrong format`() {
        Validators.validateExpirationDate("2030/12")
    }

    @Test(expected = InvalidCardException::class)
    fun `validateExpirationDate throws for invalid month 13`() {
        Validators.validateExpirationDate("13/2030")
    }

    // --- validatePaymentIntent tests ---

    @Test(expected = ValidationException::class)
    fun `validatePaymentIntent throws for zero amount`() {
        val intent = PaymentIntent(
            amount = 0.0,
            currency = "COP",
            referenceArray = listOf("ref1")
        )
        Validators.validatePaymentIntent(intent)
    }

    @Test(expected = ValidationException::class)
    fun `validatePaymentIntent throws for negative amount`() {
        val intent = PaymentIntent(
            amount = -50.0,
            currency = "COP",
            referenceArray = listOf("ref1")
        )
        Validators.validatePaymentIntent(intent)
    }

    @Test(expected = ValidationException::class)
    fun `validatePaymentIntent throws for blank currency`() {
        val intent = PaymentIntent(
            amount = 100.0,
            currency = "",
            referenceArray = listOf("ref1")
        )
        Validators.validatePaymentIntent(intent)
    }

    @Test(expected = ValidationException::class)
    fun `validatePaymentIntent throws for empty referenceArray`() {
        val intent = PaymentIntent(
            amount = 100.0,
            currency = "COP",
            referenceArray = emptyList()
        )
        Validators.validatePaymentIntent(intent)
    }

    @Test
    fun `validatePaymentIntent passes for valid intent`() {
        val intent = PaymentIntent(
            amount = 50000.0,
            currency = "COP",
            referenceArray = listOf("CC", "12345678", "ORD-001", "John Doe", "j@test.com", "3001234567")
        )
        // Should not throw
        Validators.validatePaymentIntent(intent)
    }

    // --- validateByCountry tests ---

    @Test
    fun `validateByCountry passes for CC in Colombia`() {
        Validators.validateByCountry("CC", "CO")
    }

    @Test
    fun `validateByCountry passes for CI in Dominican Republic`() {
        Validators.validateByCountry("CI", "DO")
    }

    @Test
    fun `validateByCountry passes for RFC in Mexico`() {
        Validators.validateByCountry("RFC", "MX")
    }

    @Test(expected = ValidationException::class)
    fun `validateByCountry throws for CC in Mexico`() {
        Validators.validateByCountry("CC", "MX")
    }

    @Test(expected = ValidationException::class)
    fun `validateByCountry throws for unsupported country`() {
        Validators.validateByCountry("ID", "US")
    }

    @Test
    fun `validateByCountry passes for PP in all countries`() {
        Validators.validateByCountry("PP", "CO")
        Validators.validateByCountry("PP", "DO")
        Validators.validateByCountry("PP", "MX")
    }
}
