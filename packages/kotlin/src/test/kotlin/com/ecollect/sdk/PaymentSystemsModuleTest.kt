package com.ecollect.sdk

import com.ecollect.sdk.exceptions.*
import com.ecollect.sdk.modules.PaymentSystemsModule
import com.ecollect.sdk.modules.SessionModule
import com.ecollect.sdk.types.*
import com.ecollect.sdk.utils.HttpClient
import io.mockk.*
import kotlinx.coroutines.test.runTest
import org.junit.Assert.*
import org.junit.Test

class PaymentSystemsModuleTest {

    private fun makeModule(sessionToken: String = "test-session"): Triple<PaymentSystemsModule, SessionModule, HttpClient> {
        val config = Config(etyCode = 123, sessionToken = sessionToken, environment = Environment.TEST)
        val httpClient = mockk<HttpClient>()
        val session = mockk<SessionModule>()
        coEvery { session.getSessionToken() } returns sessionToken
        every { session.invalidate() } just Runs
        val module = PaymentSystemsModule(config, httpClient, session)
        return Triple(module, session, httpClient)
    }

    @Test
    fun `getPaymentSystems returns list with parsed entries`() = runTest {
        val (module, _, httpClient) = makeModule()
        val response = GetPaymentSystemResponse(
            returnCode = "SUCCESS",
            paymentSystemArray = listOf(
                PaymentSystemType(
                    paymentSystem = "1",
                    brandImageUrl = "https://cdn.ecollect.com/visa.png",
                    fiImagesArray = emptyList(),
                    fiArray = listOf(
                        FiType("VISA", "Visa"),
                        FiType("MC", "Mastercard")
                    )
                )
            )
        )
        coEvery { httpClient.post<Any, GetPaymentSystemResponse>(any(), any()) } returns response

        val result = module.getPaymentSystems()

        assertEquals("SUCCESS", result.returnCode)
        assertNotNull(result.paymentSystemArray)
        val psArray = result.paymentSystemArray!!
        assertEquals(1, psArray.size)
        assertEquals("1", psArray[0].paymentSystem)
    }

    @Test
    fun `getPaymentSystems parses FiCode and FiName correctly`() = runTest {
        val (module, _, httpClient) = makeModule()
        val response = GetPaymentSystemResponse(
            returnCode = "SUCCESS",
            paymentSystemArray = listOf(
                PaymentSystemType(
                    paymentSystem = "2",
                    fiArray = listOf(
                        FiType("AMEX", "American Express")
                    )
                )
            )
        )
        coEvery { httpClient.post<Any, GetPaymentSystemResponse>(any(), any()) } returns response

        val result = module.getPaymentSystems()
        val fi = result.paymentSystemArray?.first()?.fiArray?.first()

        assertEquals("AMEX", fi?.fiCode)
        assertEquals("American Express", fi?.fiName)
    }

    @Test
    fun `getPaymentSystems returns NO_RECORDS response with empty array`() = runTest {
        val (module, _, httpClient) = makeModule()
        val response = GetPaymentSystemResponse(returnCode = "NO_RECORDS", paymentSystemArray = null)
        coEvery { httpClient.post<Any, GetPaymentSystemResponse>(any(), any()) } returns response

        val result = module.getPaymentSystems()

        assertEquals("NO_RECORDS", result.returnCode)
        assertNull(result.paymentSystemArray)
    }

    @Test
    fun `getPaymentSystems throws NetworkRetryableException on FAIL_SYSTEM`() = runTest {
        val (module, _, httpClient) = makeModule()
        coEvery { httpClient.post<Any, GetPaymentSystemResponse>(any(), any()) } returns GetPaymentSystemResponse(
            returnCode = "FAIL_SYSTEM"
        )

        try {
            module.getPaymentSystems()
            fail("Should throw NetworkRetryableException")
        } catch (e: NetworkRetryableException) {
            assertNotNull(e.message)
        }
    }

    @Test
    fun `getPaymentSystems throws AuthenticationException on FAIL_ACCESSDENIED`() = runTest {
        val (module, _, httpClient) = makeModule()
        coEvery { httpClient.post<Any, GetPaymentSystemResponse>(any(), any()) } returns GetPaymentSystemResponse(
            returnCode = "FAIL_ACCESSDENIED"
        )

        try {
            module.getPaymentSystems()
            fail("Should throw AuthenticationException")
        } catch (e: AuthenticationException) {
            assertNotNull(e.message)
        }
    }
}
