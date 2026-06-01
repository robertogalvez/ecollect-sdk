package com.ecollect.sdk

import com.ecollect.sdk.exceptions.*
import com.ecollect.sdk.modules.ReconciliationModule
import com.ecollect.sdk.modules.SessionModule
import com.ecollect.sdk.types.GetTransactionResponse
import com.ecollect.sdk.utils.HttpClient
import io.mockk.*
import kotlinx.coroutines.test.runTest
import org.junit.Assert.*
import org.junit.Test

class ReconciliationModuleTest {

    private fun makeModule(sessionToken: String = "test-session"): Triple<ReconciliationModule, SessionModule, HttpClient> {
        val config = Config(etyCode = 123, sessionToken = sessionToken, environment = Environment.TEST)
        val httpClient = mockk<HttpClient>()
        val session = mockk<SessionModule>()
        coEvery { session.getSessionToken() } returns sessionToken
        every { session.invalidate() } just Runs
        val module = ReconciliationModule(config, httpClient, session)
        return Triple(module, session, httpClient)
    }

    private fun txResponse(tranState: String, returnCode: String = "SUCCESS") = GetTransactionResponse(
        returnCode = returnCode,
        ticketId = 1001L,
        tranState = tranState,
        fiCode = "VISA",
        fiName = "Visa",
        transValue = 100.0,
        payCurrency = "COP"
    )

    @Test
    fun `getTransactionStatus returns APPROVED state`() = runTest {
        val (module, _, httpClient) = makeModule()
        coEvery { httpClient.post<Any, GetTransactionResponse>(any(), any()) } returns txResponse("OK")

        val result = module.getTransactionStatus(ticketId = 1001L)

        assertEquals("OK", result.tranState)
        assertEquals("SUCCESS", result.returnCode)
    }

    @Test
    fun `getTransactionStatus returns PENDING state`() = runTest {
        val (module, _, httpClient) = makeModule()
        coEvery { httpClient.post<Any, GetTransactionResponse>(any(), any()) } returns txResponse("PENDING")

        val result = module.getTransactionStatus(ticketId = 1001L)

        assertEquals("PENDING", result.tranState)
    }

    @Test
    fun `getTransactionStatus throws exception when neither ticketId nor merchantTransactionId provided`() = runTest {
        val (module) = makeModule()

        try {
            module.getTransactionStatus()
            fail("Should throw IllegalArgumentException")
        } catch (e: IllegalArgumentException) {
            assertNotNull(e.message)
        }
    }

    @Test
    fun `getTransactionStatus accepts merchantTransactionId as fallback`() = runTest {
        val (module, _, httpClient) = makeModule()
        coEvery { httpClient.post<Any, GetTransactionResponse>(any(), any()) } returns txResponse("OK")

        val result = module.getTransactionStatus(merchantTransactionId = "ORDER-001")

        assertEquals("OK", result.tranState)
    }

    @Test
    fun `reconciliate resolves after two PENDING polls then OK`() = runTest {
        val (module, _, httpClient) = makeModule()
        var callCount = 0
        coEvery { httpClient.post<Any, GetTransactionResponse>(any(), any()) } answers {
            callCount++
            if (callCount < 3) txResponse("PENDING") else txResponse("OK")
        }

        // Use a very short timeout window; but since we mock delays, we need to test
        // getTransactionStatus directly (reconciliate calls kotlinx.coroutines.delay which
        // runTest advances automatically)
        val result = module.reconciliate(ticketId = 1001L, timeoutMs = 600_000L)

        assertEquals("OK", result.tranState)
        assertEquals(3, callCount)
    }

    @Test
    fun `reconciliate throws PollingTimeoutException when state never becomes final`() = runTest {
        val (module, _, httpClient) = makeModule()
        coEvery { httpClient.post<Any, GetTransactionResponse>(any(), any()) } returns txResponse("PENDING")

        try {
            module.reconciliate(ticketId = 1001L, timeoutMs = 1L) // 1ms timeout — immediately expires
            fail("Should throw PollingTimeoutException")
        } catch (e: PollingTimeoutException) {
            assertNotNull(e.message)
        }
    }

    @Test
    fun `getTransactionStatus throws TokenNotFoundException on FAIL_INVALIDTICKETID`() = runTest {
        val (module, _, httpClient) = makeModule()
        coEvery { httpClient.post<Any, GetTransactionResponse>(any(), any()) } returns GetTransactionResponse(
            returnCode = "FAIL_INVALIDTICKETID"
        )

        try {
            module.getTransactionStatus(ticketId = 9999L)
            fail("Should throw TokenNotFoundException")
        } catch (e: TokenNotFoundException) {
            assertNotNull(e.message)
        }
    }
}
