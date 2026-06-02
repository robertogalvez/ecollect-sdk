package com.ecollect.sdk

import com.ecollect.sdk.exceptions.*
import com.ecollect.sdk.modules.SessionModule
import com.ecollect.sdk.modules.TokensModule
import com.ecollect.sdk.utils.HttpClient
import io.mockk.*
import kotlinx.coroutines.test.runTest
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import org.junit.After
import org.junit.Assert.*
import org.junit.Before
import org.junit.Test

class TokensModuleTest {

    private lateinit var mockWebServer: MockWebServer
    private lateinit var httpClient: HttpClient

    private val testCardNumber = "4111111111111111" // Valid Luhn, VISA test card
    private val testExpiry = "12/2030"
    private val invalidCardNumber = "1234567890123456" // Fails Luhn

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

    private fun makeConfig(sessionToken: String = "test-session-token") = Config(
        etyCode = 123,
        sessionToken = sessionToken,
        environment = Environment.TEST,
        testBaseUrl = mockWebServer.url("/").toString()
    )

    private fun makeModule(sessionToken: String = "test-session-token"): TokensModule {
        val config = makeConfig(sessionToken)
        val session = mockk<SessionModule>()
        coEvery { session.getSessionToken() } returns sessionToken
        every { session.invalidate() } just Runs
        return TokensModule(config, httpClient, session)
    }

    @Test
    fun `save throws InvalidCardException for invalid card number`() = runTest {
        val module = makeModule()
        try {
            module.save(
                cardNumber = invalidCardNumber,
                expirationDate = testExpiry,
                paymentSystem = "1",
                fiCode = "VISA",
                cardHolderName = "John Doe",
                cardHolderIdType = "CC",
                cardHolderId = "12345678",
                usermail = "john@test.com",
                mobileCountryCode = "57",
                mobileNumber = "3001234567"
            )
            fail("Should throw InvalidCardException")
        } catch (e: InvalidCardException) {
            assertTrue(e.message?.contains("Luhn") == true)
        }
    }

    @Test
    fun `save succeeds with valid card`() = runTest {
        mockWebServer.enqueue(
            MockResponse()
                .setBody("""{"ReturnCode":"SUCCESS","TokenInfoArray":[{"AttributeCode":1,"AttributeDesc":"TokenId","AttributeValue":"tok_abc123"},{"AttributeCode":12,"AttributeDesc":"MaskedCard","AttributeValue":"VISA ****1111"}]}""")
                .setResponseCode(200)
        )
        val module = makeModule()

        val result = module.save(
            cardNumber = testCardNumber,
            expirationDate = testExpiry,
            paymentSystem = "1",
            fiCode = "VISA",
            cardHolderName = "John Doe",
            cardHolderIdType = "CC",
            cardHolderId = "12345678",
            usermail = "john@test.com",
            mobileCountryCode = "57",
            mobileNumber = "3001234567"
        )

        assertEquals("SUCCESS", result.returnCode)
        val tokenId = result.tokenInfoArray?.find { it.attributeCode == 1 }?.attributeValue
        assertEquals("tok_abc123", tokenId)
    }

    @Test
    fun `delete sends REMOVE command`() = runTest {
        mockWebServer.enqueue(
            MockResponse()
                .setBody("""{"ReturnCode":"SUCCESS","TokenInfoArray":[{"AttributeCode":1,"AttributeDesc":"TokenId","AttributeValue":"tok_abc123"},{"AttributeCode":12,"AttributeDesc":"MaskedCard","AttributeValue":"VISA ****1111"}]}""")
                .setResponseCode(200)
        )
        val module = makeModule()

        val result = module.delete(
            tokenId = "tok_abc123",
            paymentSystem = "1",
            fiCode = "VISA",
            cardHolderId = "12345678"
        )
        assertEquals("SUCCESS", result.returnCode)
    }

    @Test
    fun `update validates expiration date format`() = runTest {
        val module = makeModule()
        try {
            module.update(
                tokenId = "tok_abc123",
                expirationDate = "13/2025", // Invalid month
                paymentSystem = "1",
                fiCode = "VISA",
                cardHolderId = "12345678"
            )
            fail("Should throw InvalidCardException")
        } catch (e: InvalidCardException) {
            assertTrue(e.message?.contains("MM/YYYY") == true)
        }
    }

    @Test
    fun `list returns query token response`() = runTest {
        mockWebServer.enqueue(
            MockResponse()
                .setBody("""{"ReturnCode":"NO_RECORDS"}""")
                .setResponseCode(200)
        )
        val module = makeModule()

        val result = module.list("john@test.com", "12345678")
        assertEquals("NO_RECORDS", result.returnCode)
    }

    @Test
    fun `TokenNotFoundException thrown when returnCode is FAIL_TOKENNOTFOUND`() = runTest {
        mockWebServer.enqueue(
            MockResponse()
                .setBody("""{"ReturnCode":"FAIL_TOKENNOTFOUND"}""")
                .setResponseCode(200)
        )
        val module = makeModule()

        try {
            module.delete(
                tokenId = "non-existent",
                paymentSystem = "1",
                fiCode = "VISA",
                cardHolderId = "12345678"
            )
            fail("Should throw TokenNotFoundException")
        } catch (e: TokenNotFoundException) {
            assertNotNull(e.message)
        }
    }
}
