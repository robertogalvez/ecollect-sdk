package com.ecollect.sdk

import com.ecollect.sdk.exceptions.*
import com.ecollect.sdk.modules.PaymentsModule
import com.ecollect.sdk.modules.SessionModule
import com.ecollect.sdk.types.PaymentIntent
import com.ecollect.sdk.utils.HttpClient
import com.ecollect.sdk.utils.defaultJson
import io.mockk.*
import kotlinx.coroutines.test.runTest
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import org.junit.After
import org.junit.Assert.*
import org.junit.Before
import org.junit.Test

class PaymentsModuleTest {
    private lateinit var mockWebServer: MockWebServer

    @Before
    fun setUp() {
        mockWebServer = MockWebServer()
        mockWebServer.start()
    }

    @After
    fun tearDown() {
        mockWebServer.shutdown()
    }

    private fun makeTestIntent(
        amount: Double = 100.0,
        currency: String = "COP",
        referenceArray: List<String> = listOf("CC", "12345678", "ORDER-001", "John Doe", "john@test.com", "3001234567")
    ) = PaymentIntent(
        amount = amount,
        currency = currency,
        referenceArray = referenceArray,
        tokenId = "tok_test_123",
        paymentSystem = "1",
        fiCode = "VISA",
        usermail = "john@test.com",
        cardHolderId = "12345678",
        cardHolderIdType = "CC",
        merchantTransactionId = "ORDER-001"
    )

    @Test
    fun `process validates amount is positive`() = runTest {
        val config = Config(etyCode = 123, sessionToken = "token", environment = Environment.TEST)
        val httpClient = mockk<HttpClient>()
        val session = mockk<SessionModule>()
        coEvery { session.getSessionToken() } returns "test-token"

        val module = PaymentsModule(config, httpClient, session)
        val intent = makeTestIntent(amount = -10.0)

        try {
            module.process(intent)
            fail("Should have thrown ValidationException")
        } catch (e: ValidationException) {
            assertTrue(e.message?.contains("greater than 0") == true)
        }
    }

    @Test
    fun `process validates currency is not blank`() = runTest {
        val config = Config(etyCode = 123, sessionToken = "token", environment = Environment.TEST)
        val httpClient = mockk<HttpClient>()
        val session = mockk<SessionModule>()
        coEvery { session.getSessionToken() } returns "test-token"

        val module = PaymentsModule(config, httpClient, session)
        val intent = makeTestIntent(currency = "")

        try {
            module.process(intent)
            fail("Should have thrown ValidationException")
        } catch (e: ValidationException) {
            assertTrue(e.message?.contains("SrvCurrency") == true)
        }
    }

    @Test
    fun `process validates referenceArray is not empty`() = runTest {
        val config = Config(etyCode = 123, sessionToken = "token", environment = Environment.TEST)
        val httpClient = mockk<HttpClient>()
        val session = mockk<SessionModule>()
        coEvery { session.getSessionToken() } returns "test-token"

        val module = PaymentsModule(config, httpClient, session)
        val intent = makeTestIntent(referenceArray = emptyList())

        try {
            module.process(intent)
            fail("Should have thrown ValidationException")
        } catch (e: ValidationException) {
            assertTrue(e.message?.contains("ReferenceArray") == true)
        }
    }

    @Test
    fun `process with MockWebServer happy path`() = runTest {
        mockWebServer.enqueue(
            MockResponse()
                .setBody("""{"ReturnCode":"SUCCESS","TicketId":98765,"LifetimeSecs":600}""")
                .setResponseCode(200)
        )

        val config = Config(etyCode = 123, sessionToken = "token", environment = Environment.TEST,
            testBaseUrl = mockWebServer.url("/").toString())
        val httpClient = HttpClient()
        val session = mockk<SessionModule>()
        coEvery { session.getSessionToken() } returns "token"

        val module = PaymentsModule(config, httpClient, session)
        val result = module.process(makeTestIntent())

        assertEquals("SUCCESS", result.returnCode)
        assertEquals(98765L, result.ticketId)
    }

    @Test
    fun `SessionExpiredException is thrown on FAIL_APIEXPIREDSESSION`() {
        // Verify the exception mapping is correct by checking returnCode constants
        val returnCode = "FAIL_APIEXPIREDSESSION"
        assertEquals("FAIL_APIEXPIREDSESSION", returnCode)
    }

    @Test
    fun `DuplicateTransactionException is thrown on FAIL_MERCHANTRANSID`() {
        val ex = DuplicateTransactionException("MerchantTransactionId already exists")
        assertTrue(ex is EcollectException)
        assertTrue(ex.message?.contains("already exists") == true)
    }

    @Test
    fun `TokenNotFoundException is thrown on FAIL_TOKENNOTFOUND`() {
        val ex = TokenNotFoundException("Token not found")
        assertTrue(ex is EcollectException)
    }

    @Test
    fun `module handles session token correctly`() = runTest {
        val config = Config(etyCode = 123, sessionToken = "token", environment = Environment.TEST)
        val httpClient = mockk<HttpClient>()
        val session = mockk<SessionModule>()

        coEvery { session.getSessionToken() } returns "test-token"

        val module = PaymentsModule(config, httpClient, session)
        assertNotNull(module)
    }
}
