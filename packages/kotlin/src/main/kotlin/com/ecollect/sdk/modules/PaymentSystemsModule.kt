package com.ecollect.sdk.modules

import com.ecollect.sdk.Config
import com.ecollect.sdk.exceptions.*
import com.ecollect.sdk.types.*
import com.ecollect.sdk.utils.HttpClient

class PaymentSystemsModule(
    private val config: Config,
    private val httpClient: HttpClient,
    private val sessionModule: SessionModule
) {
    /**
     * Get all payment systems (channels) enabled for this merchant.
     * Use FiImagesArray.FindKeys to detect card brand from the first digits.
     */
    suspend fun getPaymentSystems(): GetPaymentSystemResponse {
        val token = sessionModule.getSessionToken()
        val request = GetPaymentSystemRequest(
            entityCode = config.etyCode,
            sessionToken = token
        )
        val url = "${config.baseUrl}getPaymentSystem"
        val response: GetPaymentSystemResponse = httpClient.post(url, request)
        return when (response.returnCode) {
            "SUCCESS", "NO_RECORDS" -> response
            "FAIL_APIEXPIREDSESSION" -> {
                sessionModule.invalidate()
                val newToken = sessionModule.getSessionToken()
                val retryResponse: GetPaymentSystemResponse = httpClient.post(
                    url,
                    request.copy(sessionToken = newToken)
                )
                retryResponse
            }
            "FAIL_INVALIDENTITYCODE" -> throw InvalidConfigException("EntityCode is invalid")
            "FAIL_ACCESSDENIED" -> throw AuthenticationException("Session token authentication failed")
            "FAIL_SYSTEM" -> throw NetworkRetryableException("ecollect system error fetching payment systems")
            else -> response
        }
    }
}
