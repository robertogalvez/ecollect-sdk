package com.ecollect.sdk.utils

import com.ecollect.sdk.exceptions.PollingTimeoutException
import com.ecollect.sdk.types.GetTransactionResponse
import com.ecollect.sdk.types.TranState
import kotlinx.coroutines.delay

class PollingManager(
    private val fetchStatus: suspend (ticketId: Long) -> GetTransactionResponse,
    private val timeoutMs: Long = 600_000L  // 10 minutes default
) {
    /**
     * Poll transaction status until final state or timeout.
     * - BANK/PENDING: poll every 30s
     * - CREATED: poll every 5 minutes
     */
    suspend fun pollUntilFinal(ticketId: Long): GetTransactionResponse {
        val startTime = System.currentTimeMillis()

        while (true) {
            val response = fetchStatus(ticketId)
            val state = TranState.from(response.tranState ?: "UNKNOWN")

            if (state.isFinal) {
                return response
            }

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

            delay(delayMs)
        }
    }
}
