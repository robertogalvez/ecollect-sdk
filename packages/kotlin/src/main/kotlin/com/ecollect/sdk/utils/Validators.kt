package com.ecollect.sdk.utils

import com.ecollect.sdk.exceptions.InvalidCardException
import com.ecollect.sdk.exceptions.ValidationException
import com.ecollect.sdk.types.PaymentIntent

object Validators {

    fun luhnCheck(cardNumber: String): Boolean {
        val digits = cardNumber.filter { it.isDigit() }
        if (digits.length < 13 || digits.length > 19) return false
        var sum = 0
        var alternate = false
        for (i in digits.length - 1 downTo 0) {
            var n = digits[i].digitToInt()
            if (alternate) {
                n *= 2
                if (n > 9) n -= 9
            }
            sum += n
            alternate = !alternate
        }
        return sum % 10 == 0
    }

    fun validatePaymentIntent(intent: PaymentIntent) {
        if (intent.amount <= 0) {
            throw ValidationException("TransValue must be greater than 0")
        }
        if (intent.currency.isBlank()) {
            throw ValidationException("SrvCurrency is required")
        }
        if (intent.referenceArray.isEmpty()) {
            throw ValidationException("ReferenceArray must contain at least one reference")
        }
        intent.vatValue?.let {
            if (it < 0) throw ValidationException("TransVatValue cannot be negative")
        }
    }

    fun validateCardNumber(cardNumber: String) {
        if (!luhnCheck(cardNumber)) {
            throw InvalidCardException("Card number failed Luhn check: invalid card number")
        }
    }

    fun validateExpirationDate(expiry: String) {
        // Format: MM/YYYY
        val regex = Regex("""^(0[1-9]|1[0-2])/\d{4}$""")
        if (!regex.matches(expiry)) {
            throw InvalidCardException("Expiration date must be in MM/YYYY format")
        }
        val parts = expiry.split("/")
        val month = parts[0].toInt()
        val year = parts[1].toInt()
        val now = java.util.Calendar.getInstance()
        val currentYear = now.get(java.util.Calendar.YEAR)
        val currentMonth = now.get(java.util.Calendar.MONTH) + 1
        if (year < currentYear || (year == currentYear && month < currentMonth)) {
            throw InvalidCardException("Card has expired: $expiry")
        }
    }

    private val countryDocumentTypes = mapOf(
        "CO" to listOf("CC", "NIT", "PP", "CE", "DE"),
        "DO" to listOf("CI", "RNC", "PP"),
        "MX" to listOf("CURP", "IFE", "RFC", "PP")
    )

    fun validateByCountry(documentType: String, country: String) {
        val allowed = countryDocumentTypes[country]
            ?: throw ValidationException("Unsupported country: $country")
        if (documentType !in allowed) {
            throw ValidationException(
                "DocumentType '$documentType' is not valid for country '$country'. " +
                "Allowed: ${allowed.joinToString()}"
            )
        }
    }
}
