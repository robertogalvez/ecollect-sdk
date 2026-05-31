package com.ecollect.sdk.modules

import com.ecollect.sdk.Config
import com.ecollect.sdk.exceptions.*
import com.ecollect.sdk.types.*
import com.ecollect.sdk.utils.HttpClient
import com.ecollect.sdk.utils.Validators

class PaymentsModule(
    private val config: Config,
    private val httpClient: HttpClient,
    private val sessionModule: SessionModule
) {
    /**
     * Process an immediate payment transaction (RequestType=0).
     */
    suspend fun process(intent: PaymentIntent): CreateTransactionResponse {
        Validators.validatePaymentIntent(intent)
        val request = buildRequest(intent, requestType = 0)
        return executeWithRetry(request)
    }

    /**
     * Create a pre-authorization (hold) on the payment method (RequestType=1).
     * Returns TicketId for later capture or void.
     */
    suspend fun preAuthorize(intent: PaymentIntent): CreateTransactionResponse {
        Validators.validatePaymentIntent(intent)
        val request = buildRequest(intent, requestType = 1)
        return executeWithRetry(request)
    }

    /**
     * Capture (post) a previously pre-authorized transaction.
     * @param ticketId The TicketId from the pre-authorization.
     * @param amount The final amount to capture.
     * @param currency The currency code.
     * @param referenceArray References identifying the transaction.
     */
    suspend fun capture(
        ticketId: Long,
        amount: Double,
        currency: String,
        referenceArray: List<String>
    ): CreateTransactionResponse {
        val token = sessionModule.getSessionToken()
        val request = CreateTransactionRequest(
            entityCode = config.etyCode,
            sessionToken = token,
            srvCode = config.srvCode,
            transValue = amount,
            srvCurrency = currency,
            requestType = ticketId.toInt(),
            referenceArray = referenceArray
        )
        return executeWithRetry(request)
    }

    /**
     * Void (reverse) a pre-authorization before it has been captured.
     * @param ticketId The TicketId from the pre-authorization.
     * @param amount The original pre-authorized amount.
     * @param currency The currency code.
     * @param referenceArray References identifying the transaction.
     */
    suspend fun void(
        ticketId: Long,
        amount: Double,
        currency: String,
        referenceArray: List<String>
    ): CreateTransactionResponse {
        val token = sessionModule.getSessionToken()
        val request = CreateTransactionRequest(
            entityCode = config.etyCode,
            sessionToken = token,
            srvCode = config.srvCode,
            transValue = amount,
            srvCurrency = currency,
            requestType = (-ticketId).toInt(),
            referenceArray = referenceArray
        )
        return executeWithRetry(request)
    }

    /**
     * Generate a hosted checkout URL where the user is redirected to ecollect's payment page.
     */
    suspend fun hostedCheckout(intent: PaymentIntent): CreateTransactionResponse {
        Validators.validatePaymentIntent(intent)
        requireNotNull(intent.urlRedirect) {
            "urlRedirect is required for hosted checkout"
        }
        val request = buildRequest(intent, requestType = 0)
        return executeWithRetry(request)
    }

    private suspend fun buildRequest(intent: PaymentIntent, requestType: Int): CreateTransactionRequest {
        val token = sessionModule.getSessionToken()
        val paymentInfoList = mutableListOf<PaymentInfoType>()

        intent.usermail?.let { paymentInfoList.add(PaymentInfoType(6, "Usermail", it)) }
        intent.mobileCountryCode?.let { paymentInfoList.add(PaymentInfoType(7, "MobileCountryCode", it)) }
        intent.mobileNumber?.let { paymentInfoList.add(PaymentInfoType(8, "MobileNumber", it)) }
        intent.cardHolderIdType?.let { paymentInfoList.add(PaymentInfoType(18, "CardHolderIdType", it)) }
        intent.cardHolderId?.let { paymentInfoList.add(PaymentInfoType(19, "CardHolderId", it)) }
        intent.ipAddress?.let { paymentInfoList.add(PaymentInfoType(23, "IPAddress", it)) }
        intent.deviceFingerPrint?.let { paymentInfoList.add(PaymentInfoType(24, "DeviceFingerPrint", it)) }
        intent.merchantTransactionId?.let { paymentInfoList.add(PaymentInfoType(26, "MerchantTransactionId", it)) }
        intent.userType?.let { paymentInfoList.add(PaymentInfoType(34, "UserType", it)) }
        intent.extraPaymentInfo?.let { paymentInfoList.addAll(it) }

        val tokenInfoList = mutableListOf<PaymentInfoType>()
        intent.tokenId?.let { tokenInfoList.add(PaymentInfoType(1, "TokenId", it)) }
        intent.paymentSystem?.let { tokenInfoList.add(PaymentInfoType(2, "PaymentSystem", it)) }
        intent.secureCode?.let { tokenInfoList.add(PaymentInfoType(3, "SecureCode", it)) }
        intent.installments?.let { tokenInfoList.add(PaymentInfoType(5, "Installments", it.toString())) }
        intent.usermail?.let { tokenInfoList.add(PaymentInfoType(6, "Usermail", it)) }
        intent.fiCode?.let { tokenInfoList.add(PaymentInfoType(9, "FiCode", it)) }
        intent.cardHolderId?.let { tokenInfoList.add(PaymentInfoType(19, "CardHolderId", it)) }
        intent.extraTokenInfo?.let { tokenInfoList.addAll(it) }

        return CreateTransactionRequest(
            entityCode = config.etyCode,
            sessionToken = token,
            srvCode = intent.srvCode ?: config.srvCode,
            transValue = intent.amount,
            transVatValue = intent.vatValue,
            srvCurrency = intent.currency,
            urlRedirect = intent.urlRedirect,
            urlResponse = intent.urlResponse,
            langCode = intent.langCode,
            paymentSystem = intent.paymentSystem,
            fiCode = intent.fiCode,
            invoice = intent.invoice,
            invoiceDueDate = intent.invoiceDueDate,
            policyCode = intent.policyCode,
            requestType = requestType,
            referenceArray = intent.referenceArray,
            paymentInfoArray = paymentInfoList.ifEmpty { null },
            tokenInfoArray = tokenInfoList.ifEmpty { null },
            subservicesArray = intent.subservices,
            channelInfoArray = intent.channelInfo
        )
    }

    private suspend fun executeWithRetry(
        request: CreateTransactionRequest,
        maxRetries: Int = 3
    ): CreateTransactionResponse {
        var attempt = 0
        var lastException: Exception? = null

        while (attempt <= maxRetries) {
            try {
                val url = "${config.baseUrl}createTransactionPayment"
                val response: CreateTransactionResponse = httpClient.post(url, request)
                return mapResponseToException(response, request)
            } catch (e: NetworkRetryableException) {
                lastException = e
                attempt++
                if (attempt <= maxRetries) {
                    kotlinx.coroutines.delay(2000L * Math.pow(2.0, attempt.toDouble()).toLong())
                }
            } catch (e: SessionExpiredException) {
                // Auto-refresh and retry once
                sessionModule.invalidate()
                val newToken = sessionModule.getSessionToken()
                val retryRequest = request.copy(sessionToken = newToken)
                val url = "${config.baseUrl}createTransactionPayment"
                val response: CreateTransactionResponse = httpClient.post(url, retryRequest)
                return mapResponseToException(response, retryRequest)
            }
        }
        throw lastException ?: NetworkRetryableException("Request failed after $maxRetries retries")
    }

    private fun mapResponseToException(
        response: CreateTransactionResponse,
        request: CreateTransactionRequest
    ): CreateTransactionResponse {
        return when (response.returnCode) {
            "SUCCESS" -> response
            "FAIL_APIEXPIREDSESSION" -> throw SessionExpiredException("Session token has expired")
            "FAIL_INVALIDENTITYCODE" -> throw InvalidConfigException("EntityCode is invalid: ${config.etyCode}")
            "FAIL_INVALIDSERVICECODE" -> throw InvalidConfigException("SrvCode is invalid: ${request.srvCode}")
            "FAIL_INVALIDCREDITCARD" -> throw InvalidCardException("Card number is invalid (Luhn check failed)")
            "FAIL_INVALIDEXPIRATIONDATE" -> throw InvalidCardException("Card expiration date is invalid")
            "FAIL_TOKENNOTFOUND", "FAIL_TOKENEXPIRED" -> throw TokenNotFoundException("Token not found or expired")
            "FAIL_MERCHANTRANSID" -> throw DuplicateTransactionException(
                "MerchantTransactionId already exists: ${request.paymentInfoArray?.find { it.attributeCode == 26 }?.attributeValue}"
            )
            "FAIL_ACCESSDENIED" -> throw AuthenticationException("Session token authentication failed")
            "FAIL_SYSTEM" -> throw NetworkRetryableException("ecollect system error")
            else -> response // Return non-fatal codes (e.g. FAIL_INVALIDREFERENCE1) to caller
        }
    }
}
