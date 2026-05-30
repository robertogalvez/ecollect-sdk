package com.ecollect.sdk.modules

import com.ecollect.sdk.Config
import com.ecollect.sdk.exceptions.*
import com.ecollect.sdk.types.*
import com.ecollect.sdk.utils.HttpClient

class CustomersModule(
    private val config: Config,
    private val httpClient: HttpClient,
    private val sessionModule: SessionModule
) {
    /**
     * Get or create a CustomerId for a customer.
     * If the customer already exists, the same CustomerId is returned.
     * CustomerId can be used to reduce payload size on subsequent tokenizations.
     *
     * @return The CustomerId string
     */
    suspend fun getOrCreateCustomerId(
        usermail: String,
        cardHolderId: String,
        cardHolderName: String,
        cardHolderIdType: String,
        mobileCountryCode: String,
        mobileNumber: String
    ): String {
        val token = sessionModule.getSessionToken()
        val customerInfoArray = listOf(
            PaymentInfoType(6, "Usermail", usermail),
            PaymentInfoType(17, "CardHolderName", cardHolderName),
            PaymentInfoType(18, "CardHolderIdType", cardHolderIdType),
            PaymentInfoType(19, "CardHolderId", cardHolderId),
            PaymentInfoType(7, "MobileCountryCode", mobileCountryCode),
            PaymentInfoType(8, "MobileNumber", mobileNumber)
        )

        val request = GetCustomerIdRequest(
            entityCode = config.etyCode,
            sessionToken = token,
            customerInfoArray = customerInfoArray
        )
        val url = "${config.baseUrl}getCustomerId"
        val response: GetCustomerIdResponse = httpClient.post(url, request)
        return handleResponse(response, token, request)
    }

    /**
     * Update a customer's information.
     */
    suspend fun updateCustomer(
        customerId: String,
        usermail: String? = null,
        cardHolderName: String? = null,
        cardHolderIdType: String? = null,
        mobileCountryCode: String? = null,
        mobileNumber: String? = null
    ): String {
        val token = sessionModule.getSessionToken()
        val customerInfoArray = mutableListOf(
            PaymentInfoType(attributeCode = 37, attributeDesc = "CustomerId", attributeValue = customerId)
        )
        usermail?.let { customerInfoArray.add(PaymentInfoType(6, "Usermail", it)) }
        cardHolderName?.let { customerInfoArray.add(PaymentInfoType(17, "CardHolderName", it)) }
        cardHolderIdType?.let { customerInfoArray.add(PaymentInfoType(18, "CardHolderIdType", it)) }
        mobileCountryCode?.let { customerInfoArray.add(PaymentInfoType(7, "MobileCountryCode", it)) }
        mobileNumber?.let { customerInfoArray.add(PaymentInfoType(8, "MobileNumber", it)) }

        val request = GetCustomerIdRequest(
            entityCode = config.etyCode,
            sessionToken = token,
            customerInfoArray = customerInfoArray
        )
        val url = "${config.baseUrl}getCustomerId"
        val response: GetCustomerIdResponse = httpClient.post(url, request)
        return handleResponse(response, token, request)
    }

    private suspend fun handleResponse(
        response: GetCustomerIdResponse,
        token: String,
        originalRequest: GetCustomerIdRequest
    ): String {
        return when (response.returnCode) {
            "SUCCESS" -> {
                response.customerInfoArray
                    ?.firstOrNull { it.attributeDesc == "CustomerId" }
                    ?.attributeValue
                    ?: throw CustomerNotFoundException("CustomerId not found in response")
            }
            "FAIL_APIEXPIREDSESSION" -> {
                sessionModule.invalidate()
                val newToken = sessionModule.getSessionToken()
                val retryResponse: GetCustomerIdResponse = httpClient.post(
                    "${config.baseUrl}getCustomerId",
                    originalRequest.copy(sessionToken = newToken)
                )
                handleResponse(retryResponse, newToken, originalRequest)
            }
            "FAIL_INVALIDENTITYCODE" -> throw InvalidConfigException("EntityCode is invalid")
            "FAIL_ACCESSDENIED" -> throw AuthenticationException("Session token authentication failed")
            "FAIL_CARDHOLDERID" -> throw ValidationException("CardHolderId is invalid")
            "FAIL_CARDHOLDERNAME" -> throw ValidationException("CardHolderName is invalid")
            "FAIL_CARDHOLDERIDTYPE" -> throw ValidationException("CardHolderIdType is not valid for this country")
            "FAIL_MOBILECOUNTRYCODE" -> throw ValidationException("MobileCountryCode is invalid")
            "FAIL_MOBILENUMBER" -> throw ValidationException("MobileNumber is invalid")
            "FAIL_MAILFORMAT" -> throw ValidationException("Usermail format is invalid")
            "FAIL_SYSTEM" -> throw NetworkRetryableException("ecollect system error during getCustomerId")
            else -> throw EcollectException("Unexpected returnCode: ${response.returnCode}")
        }
    }
}
