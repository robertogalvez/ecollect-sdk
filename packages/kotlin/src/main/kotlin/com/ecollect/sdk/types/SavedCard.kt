package com.ecollect.sdk.types

data class SavedCard(
    val tokenId: String,
    val maskedCard: String,
    val last4: String,
    val bin4: String? = null,
    val fiCode: String,
    val fiName: String,
    val paymentSystem: String,
    val brandImageUrl: String? = null,
    val usermail: String? = null,
    val customerId: String? = null,
    val tokenStatus: TokenStatus,
    val lifetimeSecs: Int? = null,
    val requiresOtp: Boolean = false
)

enum class TokenStatus {
    ACTIVE,
    VERIFY,
    EXPIRED,
    UNKNOWN;

    companion object {
        fun from(value: String): TokenStatus =
            values().firstOrNull { it.name == value } ?: UNKNOWN
    }
}
