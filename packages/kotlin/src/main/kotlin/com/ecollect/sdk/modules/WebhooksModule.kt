package com.ecollect.sdk.modules

import com.ecollect.sdk.Config
import com.ecollect.sdk.exceptions.WebhookValidationException
import com.ecollect.sdk.exceptions.AuthenticationException
import com.ecollect.sdk.exceptions.NetworkRetryableException
import com.ecollect.sdk.types.GetTransactionResponse
import com.ecollect.sdk.types.VerifySessionTokenRequest
import com.ecollect.sdk.types.VerifySessionTokenResponse
import com.ecollect.sdk.utils.Crypto
import com.ecollect.sdk.utils.HttpClient
import com.ecollect.sdk.utils.defaultJson
import kotlinx.serialization.encodeToString

class WebhooksModule(
    private val config: Config,
    private val httpClient: HttpClient,
    private val sessionModule: SessionModule
) {
    /**
     * Verify a webhook notification from ecollect.
     *
     * This method:
     * 1. Optionally verifies HMAC-SHA256 signature if webhookSecret is provided
     * 2. Verifies the SessionToken in the webhook payload via ecollect API
     *
     * @param payload The webhook payload (parsed from the incoming request body)
     * @param webhookSecret Optional HMAC secret for signature verification
     * @param rawBody Raw JSON string body (required if webhookSecret is provided)
     * @param signature HMAC signature from request header (required if webhookSecret is provided)
     */
    suspend fun verifyWebhookSignature(
        payload: GetTransactionResponse,
        webhookSecret: String? = null,
        rawBody: String? = null,
        signature: String? = null
    ): Boolean {
        // Step 1: HMAC signature check (if secret configured)
        if (webhookSecret != null && rawBody != null && signature != null) {
            val isValid = Crypto.verifyHmac(rawBody, webhookSecret, signature)
            if (!isValid) {
                throw WebhookValidationException("HMAC signature verification failed")
            }
        }

        // Step 2: Verify via ecollect API
        val webhookSessionToken = payload.sessionToken
            ?: throw WebhookValidationException("SessionToken missing from webhook payload")

        val ticketId = payload.ticketId
        return verifyViaApi(webhookSessionToken, ticketId)
    }

    /**
     * Confirm a webhook by verifying SessionToken against the ecollect API.
     *
     * @param sessionTokenToVerify The SessionToken received in the webhook payload
     * @param ticketIdToVerify Optional TicketId to verify the SessionToken matches
     */
    suspend fun confirmWebhook(
        sessionTokenToVerify: String,
        ticketIdToVerify: Long? = null
    ): Boolean {
        return verifyViaApi(sessionTokenToVerify, ticketIdToVerify)
    }

    private suspend fun verifyViaApi(
        sessionTokenToVerify: String,
        ticketId: Long?
    ): Boolean {
        val activeToken = sessionModule.getSessionToken()
        val request = VerifySessionTokenRequest(
            entityCode = config.etyCode,
            sessionToken = activeToken,
            sessionTokenToVerify = sessionTokenToVerify,
            ticketIdToVerify = ticketId
        )
        val url = "${config.baseUrl}verifySessionToken"
        val response: VerifySessionTokenResponse = httpClient.post(url, request)
        return when (response.returnCode) {
            "SUCCESS" -> true
            "FAIL_SESSIONNOTFOUND" -> throw WebhookValidationException(
                "SessionToken to verify does not exist in ecollect"
            )
            "FAIL_TICKETIDNOTMATCH" -> throw WebhookValidationException(
                "TicketId does not match the SessionToken"
            )
            "FAIL_ACCESSDENIED" -> throw AuthenticationException("Session token authentication failed")
            "FAIL_SYSTEM" -> throw NetworkRetryableException("ecollect system error during webhook verification")
            else -> throw WebhookValidationException("Unexpected returnCode: ${response.returnCode}")
        }
    }
}
