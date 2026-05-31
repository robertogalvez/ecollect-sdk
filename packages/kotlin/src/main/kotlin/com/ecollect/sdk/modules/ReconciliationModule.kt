package com.ecollect.sdk.modules

import com.ecollect.sdk.Config
import com.ecollect.sdk.exceptions.*
import com.ecollect.sdk.types.*
import com.ecollect.sdk.utils.HttpClient
import com.ecollect.sdk.utils.Polling

class ReconciliationModule(
    private val config: Config,
    private val httpClient: HttpClient,
    private val sessionModule: SessionModule
) {
    /**
     * Get the current status of a transaction.
     * Use this for the "proceso sonda" (probe process) pattern.
     */
    suspend fun getTransactionStatus(
        ticketId: Long? = null,
        merchantTransactionId: String? = null
    ): GetTransactionResponse {
        require(ticketId != null || merchantTransactionId != null) {
            "Either ticketId or merchantTransactionId must be provided"
        }

        val token = sessionModule.getSessionToken()
        val paymentInfoArray = merchantTransactionId?.let {
            listOf(PaymentInfoType(26, "MerchantTransactionId", it))
        }

        val request = GetTransactionRequest(
            entityCode = config.etyCode,
            sessionToken = token,
            ticketId = ticketId,
            paymentInfoArray = paymentInfoArray
        )

        val url = config.transactionInfoUrl
        return executeRequest(request, url)
    }

    /**
     * Poll until a transaction reaches a final state (OK, NOT_AUTHORIZED, EXPIRED, FAILED).
     * Implements the recommended polling intervals:
     *  - BANK/PENDING: every 30 seconds
     *  - CREATED: every 5 minutes
     *
     * @param ticketId The TicketId to poll
     * @param timeoutMs Maximum time to wait in milliseconds (default 10 minutes)
     */
    suspend fun reconciliate(ticketId: Long, timeoutMs: Long = 600_000L): GetTransactionResponse {
        val pollingManager = Polling.PollingManager(
            fetchStatus = { id -> getTransactionStatus(ticketId = id) },
            timeoutMs = timeoutMs
        )
        return pollingManager.pollUntilFinal(ticketId)
    }

    private suspend fun executeRequest(
        request: GetTransactionRequest,
        url: String
    ): GetTransactionResponse {
        val response: GetTransactionResponse = httpClient.post(url, request)
        return when (response.returnCode) {
            "SUCCESS" -> response
            "FAIL_APIEXPIREDSESSION" -> {
                sessionModule.invalidate()
                val newToken = sessionModule.getSessionToken()
                val retryResponse: GetTransactionResponse = httpClient.post(
                    url,
                    request.copy(sessionToken = newToken)
                )
                retryResponse
            }
            "FAIL_INVALIDENTITYCODE" -> throw InvalidConfigException("EntityCode is invalid")
            "FAIL_ACCESSDENIED" -> throw AuthenticationException("Session token authentication failed")
            "FAIL_INVALIDTICKETID" -> throw TokenNotFoundException("TicketId is invalid or does not exist")
            "FAIL_MERCHANTRANSID" -> throw DuplicateTransactionException(
                "No transaction found for this MerchantTransactionId"
            )
            "FAIL_SYSTEM" -> throw NetworkRetryableException("ecollect system error; retry later")
            else -> response
        }
    }
}

// Extension to allow PollingManager to be created from ReconciliationModule
private object Polling {
    class PollingManager(
        private val fetchStatus: suspend (Long) -> GetTransactionResponse,
        private val timeoutMs: Long
    ) {
        suspend fun pollUntilFinal(ticketId: Long): GetTransactionResponse {
            val startTime = System.currentTimeMillis()
            while (true) {
                val response = fetchStatus(ticketId)
                val state = TranState.from(response.tranState ?: "UNKNOWN")
                if (state.isFinal) return response

                val elapsed = System.currentTimeMillis() - startTime
                if (elapsed >= timeoutMs) {
                    throw PollingTimeoutException(
                        "Polling timeout after ${timeoutMs / 1000}s for ticketId=$ticketId. Last state: ${response.tranState}"
                    )
                }

                val delayMs = when (state) {
                    TranState.BANK, TranState.PENDING -> 30_000L
                    TranState.CREATED -> 300_000L
                    else -> 30_000L
                }
                kotlinx.coroutines.delay(delayMs)
            }
        }
    }
}
