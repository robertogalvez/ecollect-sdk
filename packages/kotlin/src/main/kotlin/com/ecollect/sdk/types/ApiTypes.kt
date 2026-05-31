package com.ecollect.sdk.types

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

@Serializable
data class PaymentInfoType(
    @SerialName("AttributeCode") val attributeCode: Int,
    @SerialName("AttributeDesc") val attributeDesc: String = "",
    @SerialName("AttributeValue") val attributeValue: String
)

@Serializable
data class ChannelInfoType(
    @SerialName("AttributeCode") val attributeCode: Int,
    @SerialName("AttributeDesc") val attributeDesc: String = "",
    @SerialName("AttributeValue") val attributeValue: String
)

@Serializable
data class SubserviceType(
    @SerialName("EntityCode") val entityCode: Int,
    @SerialName("SrvCode") val srvCode: String,
    @SerialName("ValueType") val valueType: Int,
    @SerialName("TransValue") val transValue: Double,
    @SerialName("TransVatValue") val transVatValue: Double? = null
)

// --- Request types ---

@Serializable
data class GetSessionTokenRequest(
    @SerialName("EntityCode") val entityCode: Int,
    @SerialName("ApiKey") val apiKey: String
)

@Serializable
data class CreateTransactionRequest(
    @SerialName("EntityCode") val entityCode: Int,
    @SerialName("SessionToken") val sessionToken: String,
    @SerialName("SrvCode") val srvCode: Int? = null,
    @SerialName("TransValue") val transValue: Double,
    @SerialName("TransVatValue") val transVatValue: Double? = null,
    @SerialName("SrvCurrency") val srvCurrency: String,
    @SerialName("URLRedirect") val urlRedirect: String? = null,
    @SerialName("URLResponse") val urlResponse: String? = null,
    @SerialName("LangCode") val langCode: String? = "ES",
    @SerialName("PaymentSystem") val paymentSystem: String? = null,
    @SerialName("FICode") val fiCode: String? = null,
    @SerialName("Invoice") val invoice: String? = null,
    @SerialName("InvoiceDueDate") val invoiceDueDate: String? = null,
    @SerialName("PolicyCode") val policyCode: String? = null,
    @SerialName("RequestType") val requestType: Int = 0,
    @SerialName("ReferenceArray") val referenceArray: List<String>,
    @SerialName("PaymentInfoArray") val paymentInfoArray: List<PaymentInfoType>? = null,
    @SerialName("TokenInfoArray") val tokenInfoArray: List<PaymentInfoType>? = null,
    @SerialName("SubservicesArray") val subservicesArray: List<SubserviceType>? = null,
    @SerialName("ChannelInfoArray") val channelInfoArray: List<ChannelInfoType>? = null
)

@Serializable
data class GetTransactionRequest(
    @SerialName("EntityCode") val entityCode: Int,
    @SerialName("SessionToken") val sessionToken: String,
    @SerialName("TicketId") val ticketId: Long? = null,
    @SerialName("PaymentInfoArray") val paymentInfoArray: List<PaymentInfoType>? = null
)

@Serializable
data class TokenCommandRequest(
    @SerialName("EntityCode") val entityCode: Int,
    @SerialName("SessionToken") val sessionToken: String,
    @SerialName("Command") val command: String,
    @SerialName("TokenInfoArray") val tokenInfoArray: List<PaymentInfoType>
)

@Serializable
data class QueryTokenRequest(
    @SerialName("EntityCode") val entityCode: Int,
    @SerialName("SessionToken") val sessionToken: String,
    @SerialName("TokenInfoArray") val tokenInfoArray: List<PaymentInfoType>? = null
)

@Serializable
data class GetPaymentSystemRequest(
    @SerialName("EntityCode") val entityCode: Int,
    @SerialName("SessionToken") val sessionToken: String
)

@Serializable
data class GetCustomerIdRequest(
    @SerialName("EntityCode") val entityCode: Int,
    @SerialName("SessionToken") val sessionToken: String,
    @SerialName("CustomerInfoArray") val customerInfoArray: List<PaymentInfoType>
)

@Serializable
data class VerifySessionTokenRequest(
    @SerialName("EntityCode") val entityCode: Int,
    @SerialName("SessionToken") val sessionToken: String,
    @SerialName("SessionTokenToVerify") val sessionTokenToVerify: String,
    @SerialName("TicketIdToVerify") val ticketIdToVerify: Long? = null
)

// --- Response types ---

@Serializable
data class GetSessionTokenResponse(
    @SerialName("ReturnCode") val returnCode: String,
    @SerialName("SessionToken") val sessionToken: String? = null,
    @SerialName("LifetimeSecs") val lifetimeSecs: Int? = null
)

@Serializable
data class CreateTransactionResponse(
    @SerialName("ReturnCode") val returnCode: String,
    @SerialName("TicketId") val ticketId: Long? = null,
    @SerialName("eCollectUrl") val eCollectUrl: String? = null,
    @SerialName("LifetimeSecs") val lifetimeSecs: Int? = null,
    @SerialName("TransactionResponse") val transactionResponse: GetTransactionResponse? = null
)

@Serializable
data class GetTransactionResponse(
    @SerialName("ReturnCode") val returnCode: String,
    @SerialName("EntityCode") val entityCode: Int? = null,
    @SerialName("TicketId") val ticketId: Long? = null,
    @SerialName("TrazabilityCode") val trazabilityCode: String? = null,
    @SerialName("TranState") val tranState: String? = null,
    @SerialName("TransValue") val transValue: Double? = null,
    @SerialName("TransVatValue") val transVatValue: Double? = null,
    @SerialName("PayCurrency") val payCurrency: String? = null,
    @SerialName("CurrencyRate") val currencyRate: Double? = null,
    @SerialName("BankProcessDate") val bankProcessDate: String? = null,
    @SerialName("FICode") val fiCode: String? = null,
    @SerialName("FiName") val fiName: String? = null,
    @SerialName("PaymentSystem") val paymentSystem: String? = null,
    @SerialName("TransCycle") val transCycle: String? = null,
    @SerialName("Invoice") val invoice: String? = null,
    @SerialName("ReferenceArray") val referenceArray: List<String>? = null,
    @SerialName("SrvCode") val srvCode: Int? = null,
    @SerialName("PaymentInfoArray") val paymentInfoArray: List<PaymentInfoType>? = null,
    @SerialName("ChannelInfoArray") val channelInfoArray: List<ChannelInfoType>? = null,
    @SerialName("SessionToken") val sessionToken: String? = null
)

@Serializable
data class TokenCommandResponse(
    @SerialName("ReturnCode") val returnCode: String,
    @SerialName("TokenInfoArray") val tokenInfoArray: List<PaymentInfoType>? = null
)

@Serializable
data class QueryTokenResponse(
    @SerialName("ReturnCode") val returnCode: String,
    @SerialName("TokenArray") val tokenArray: List<TokenType>? = null
)

@Serializable
data class TokenType(
    @SerialName("TokenInfoArray") val tokenInfoArray: List<PaymentInfoType>? = null,
    @SerialName("TokenStatus") val tokenStatus: String? = null,
    @SerialName("LifetimeSecs") val lifetimeSecs: Int? = null
)

@Serializable
data class FiImageType(
    @SerialName("FiCode") val fiCode: String,
    @SerialName("FindKeys") val findKeys: String? = null,
    @SerialName("BrandImageUrl") val brandImageUrl: String? = null
)

@Serializable
data class FiType(
    @SerialName("FiCode") val fiCode: String,
    @SerialName("FiName") val fiName: String
)

@Serializable
data class PaymentSystemType(
    @SerialName("PaymentSystem") val paymentSystem: String,
    @SerialName("BrandImageUrl") val brandImageUrl: String? = null,
    @SerialName("FiImagesArray") val fiImagesArray: List<FiImageType>? = null,
    @SerialName("FiArray") val fiArray: List<FiType>? = null
)

@Serializable
data class GetPaymentSystemResponse(
    @SerialName("ReturnCode") val returnCode: String,
    @SerialName("PaymentSystemArray") val paymentSystemArray: List<PaymentSystemType>? = null
)

@Serializable
data class GetCustomerIdResponse(
    @SerialName("ReturnCode") val returnCode: String,
    @SerialName("CustomerInfoArray") val customerInfoArray: List<PaymentInfoType>? = null
)

@Serializable
data class VerifySessionTokenResponse(
    @SerialName("ReturnCode") val returnCode: String
)
