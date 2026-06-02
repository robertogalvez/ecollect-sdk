package com.ecollect.sdk

import com.ecollect.sdk.exceptions.*
import com.ecollect.sdk.modules.PaymentSystemsModule
import com.ecollect.sdk.modules.SessionModule
import com.ecollect.sdk.utils.HttpClient
import io.mockk.*
import kotlinx.coroutines.test.runTest
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import org.junit.After
import org.junit.Assert.*
import org.junit.Before
import org.junit.Test

class PaymentSystemsModuleTest {

    private lateinit var mockWebServer: MockWebServer
    private lateinit var httpClient: HttpClient

    @Before
    fun setUp() {
        mockWebServer = MockWebServer()
        mockWebServer.start()
        httpClient = HttpClient()
    }

    @After
    fun tearDown() {
        mockWebServer.shutdown()
    }

    private fun makeConfig(sessionToken: String = "test-session") = Config(
        etyCode = 123,
        sessionToken = sessionToken,
        environment = Environment.TEST,
        testBaseUrl = mockWebServer.url("/").toString()
    )

    private fun makeModule(sessionToken: String = "test-session"): PaymentSystemsModule {
        val config = makeConfig(sessionToken)
        val session = mockk<SessionModule>()
        coEvery { session.getSessionToken() } returns sessionToken
        every { session.invalidate() } just Runs
        return PaymentSystemsModule(config, httpClient, session)
    }

    @Test
    fun `getPaymentSystems returns list with parsed entries`() = runTest {
        mockWebServer.enqueue(
            MockResponse()
                .setBody("""{"ReturnCode":"SUCCESS","PaymentSystemArray":[{"PaymentSystem":"1","FiArray":[{"FiCode":"VISA","FiName":"Visa"},{"FiCode":"MC","FiName":"Mastercard"}]}]}""")
                .setResponseCode(200)
        )
        val module = makeModule()

        val result = module.getPaymentSystems()

        assertEquals("SUCCESS", result.returnCode)
        assertNotNull(result.paymentSystemArray)
        val psArray = result.paymentSystemArray!!
        assertEquals(1, psArray.size)
        assertEquals("1", psArray[0].paymentSystem)
    }

    @Test
    fun `getPaymentSystems parses FiCode and FiName correctly`() = runTest {
        mockWebServer.enqueue(
            MockResponse()
                .setBody("""{"ReturnCode":"SUCCESS","PaymentSystemArray":[{"PaymentSystem":"1","FiArray":[{"FiCode":"VISA","FiName":"Visa"},{"FiCode":"MC","FiName":"Mastercard"}]}]}""")
                .setResponseCode(200)
        )
        val module = makeModule()

        val result = module.getPaymentSystems()
        val fi = result.paymentSystemArray?.first()?.fiArray?.first()

        assertEquals("VISA", fi?.fiCode)
        assertEquals("Visa", fi?.fiName)
    }

    @Test
    fun `getPaymentSystems returns NO_RECORDS response with empty array`() = runTest {
        mockWebServer.enqueue(
            MockResponse()
                .setBody("""{"ReturnCode":"NO_RECORDS"}""")
                .setResponseCode(200)
        )
        val module = makeModule()

        val result = module.getPaymentSystems()

        assertEquals("NO_RECORDS", result.returnCode)
        assertNull(result.paymentSystemArray)
    }

    @Test
    fun `getPaymentSystems throws NetworkRetryableException on FAIL_SYSTEM`() = runTest {
        mockWebServer.enqueue(
            MockResponse()
                .setBody("""{"ReturnCode":"FAIL_SYSTEM"}""")
                .setResponseCode(200)
        )
        val module = makeModule()

        try {
            module.getPaymentSystems()
            fail("Should throw NetworkRetryableException")
        } catch (e: NetworkRetryableException) {
            assertNotNull(e.message)
        }
    }

    @Test
    fun `getPaymentSystems throws AuthenticationException on FAIL_ACCESSDENIED`() = runTest {
        mockWebServer.enqueue(
            MockResponse()
                .setBody("""{"ReturnCode":"FAIL_ACCESSDENIED"}""")
                .setResponseCode(200)
        )
        val module = makeModule()

        try {
            module.getPaymentSystems()
            fail("Should throw AuthenticationException")
        } catch (e: AuthenticationException) {
            assertNotNull(e.message)
        }
    }
}
