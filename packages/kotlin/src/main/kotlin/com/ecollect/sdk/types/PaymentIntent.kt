package com.ecollect.sdk.types

data class PaymentIntent(
    val amount: Double,
    val currency: String,
    val srvCode: Int? = null,
    val referenceArray: List<String>,
    val paymentSystem: String? = null,
    val fiCode: String? = null,
    val urlRedirect: String? = null,
    val urlResponse: String? = null,
    val langCode: String = "ES",
    val invoice: String? = null,
    val invoiceDueDate: String? = null,
    val policyCode: String? = null,
    val vatValue: Double? = null,
    val merchantTransactionId: String? = null,
    val tokenId: String? = null,
    val secureCode: String? = null,
    val installments: Int? = null,
    val usermail: String? = null,
    val cardHolderName: String? = null,
    val cardHolderIdType: String? = null,
    val cardHolderId: String? = null,
    val ipAddress: String? = null,
    val deviceFingerPrint: String? = null,
    val mobileCountryCode: String? = null,
    val mobileNumber: String? = null,
    val userType: String? = null,
    val subservices: List<com.ecollect.sdk.types.SubserviceType>? = null,
    val channelInfo: List<com.ecollect.sdk.types.ChannelInfoType>? = null,
    val extraPaymentInfo: List<PaymentInfoType>? = null,
    val extraTokenInfo: List<PaymentInfoType>? = null
)

enum class TranState {
    OK,
    NOT_AUTHORIZED,
    BANK,
    PENDING,
    CAPTURED,
    CREATED,
    EXPIRED,
    FAILED,
    UNKNOWN;

    companion object {
        fun from(value: String): TranState =
            values().firstOrNull { it.name == value } ?: UNKNOWN
    }

    val isFinal: Boolean
        get() = this in setOf(OK, NOT_AUTHORIZED, EXPIRED, FAILED)

    val isIntermediate: Boolean
        get() = this in setOf(BANK, PENDING, CAPTURED, CREATED)
}
