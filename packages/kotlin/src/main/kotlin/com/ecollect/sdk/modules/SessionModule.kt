package com.ecollect.sdk.modules

import com.ecollect.sdk.Config
import com.ecollect.sdk.exceptions.AuthenticationException
import com.ecollect.sdk.exceptions.InvalidConfigException
import com.ecollect.sdk.exceptions.NetworkRetryableException
import com.ecollect.sdk.types.GetSessionTokenRequest
import com.ecollect.sdk.types.GetSessionTokenResponse
import com.ecollect.sdk.utils.HttpClient

class SessionModule(
    private val config: Config,
    private val httpClient: HttpClient
) {
    @Volatile
    private var cachedToken: String? = config.sessionToken
    @Volatile
    private var tokenExpiresAt: Long = if (config.sessionToken != null) Long.MAX_VALUE else 0L

    private val refreshThresholdSecs = 300 // refresh if <5 min remaining

    val currentToken: String?
        get() = cachedToken?.takeIf { !isExpired() }

    fun isExpired(): Boolean =
        System.currentTimeMillis() / 1000 >= tokenExpiresAt - refreshThresholdSecs

    /**
     * Get a valid session token. Uses cached token if still valid,
     * otherwise fetches a new one using the ApiKey.
     */
    suspend fun getSessionToken(): String {
        currentToken?.let { return it }
        return refresh()
    }

    /**
     * Force-refresh the session token using the ApiKey.
     * Requires apiKey to be configured (server-side use only).
     */
    suspend fun refresh(): String {
        val apiKey = config.apiKey
            ?: throw InvalidConfigException(
                "ApiKey is required to obtain a session token. " +
                "For mobile use, provide sessionToken directly."
            )

        val url = "${config.baseUrl}getSessionToken"
        val response: GetSessionTokenResponse = httpClient.post(
            url,
            GetSessionTokenRequest(entityCode = config.etyCode, apiKey = apiKey)
        )

        return when (response.returnCode) {
            "SUCCESS" -> {
                val token = response.sessionToken
                    ?: throw NetworkRetryableException("SessionToken missing from response")
                val lifetime = response.lifetimeSecs ?: 1800
                cachedToken = token
                tokenExpiresAt = (System.currentTimeMillis() / 1000) + lifetime
                token
            }
            "FAIL_INVALIDENTITYCODE" -> throw InvalidConfigException("EntityCode is invalid or not found")
            "FAIL_ACCESSDENIED" -> throw AuthenticationException("ApiKey authentication failed or merchant is inactive")
            "FAIL_SYSTEM" -> throw NetworkRetryableException("ecollect system error during session token request")
            else -> throw NetworkRetryableException("Unexpected returnCode: ${response.returnCode}")
        }
    }

    /**
     * Set a session token obtained externally (e.g., from the merchant's backend).
     * Used for mobile flows where ApiKey never lives on device.
     */
    fun setSessionToken(token: String, lifetimeSecs: Int = 1800) {
        cachedToken = token
        tokenExpiresAt = (System.currentTimeMillis() / 1000) + lifetimeSecs
    }

    fun invalidate() {
        cachedToken = null
        tokenExpiresAt = 0L
    }
}
