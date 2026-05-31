package com.ecollect.sdk

import com.ecollect.sdk.exceptions.*
import com.ecollect.sdk.modules.SessionModule
import com.ecollect.sdk.modules.TokensModule
import com.ecollect.sdk.types.TokenCommandResponse
import com.ecollect.sdk.types.PaymentInfoType
import com.ecollect.sdk.utils.HttpClient
import io.mockk.*
import kotlinx.coroutines.test.runTest
import org.junit.Assert.*
import org.junit.Test

class TokensModuleTest {

    private val testCardNumber = "4111111111111111" // Valid Luhn, VISA test card
    private val testExpiry = "12/2030"
    private val invalidCardNumber = "1234567890123456" // Fails Luhn

    private fun makeModule(
        sessionToken: String = "test-session-token"
    ): Triple<TokensModule, SessionModule, HttpClient> {
        val config = Config(etyCode = 123, sessionToken = sessionToken, environment = Environment.TEST)
        val httpClient = mockk<HttpClient>()
        val session = mockk<SessionModule>()
        coEvery { session.getSessionToken() } returns sessionToken
        val module = TokensModule(config, httpClient, session)
        return Triple(module, session, httpClient)
    }

    @Test
    fun `save throws InvalidCardException for invalid card number`() = runTest {
        val (module) = makeModule()
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
        val (module, _, httpClient) = makeModule()
        val successResponse = TokenCommandResponse(
            returnCode = "SUCCESS",
            tokenInfoArray = listOf(
                PaymentInfoType(1, "TokenId", "tok_abc123"),
                PaymentInfoType(11, "Last4", "1111"),
                PaymentInfoType(12, "MaskedCard", "VISA ****1111")
            )
        )
        coEvery { httpClient.post<Any, TokenCommandResponse>(any(), any()) } returns successResponse

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
        val (module, _, httpClient) = makeModule()
        val successResponse = TokenCommandResponse(returnCode = "SUCCESS")
        coEvery { httpClient.post<Any, TokenCommandResponse>(any(), any()) } returns successResponse

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
        val (module) = makeModule()
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
        val (module, _, httpClient) = makeModule()
        val response = com.ecollect.sdk.types.QueryTokenResponse(returnCode = "NO_RECORDS")
        coEvery { httpClient.post<Any, com.ecollect.sdk.types.QueryTokenResponse>(any(), any()) } returns response

        val result = module.list("john@test.com", "12345678")
        assertEquals("NO_RECORDS", result.returnCode)
    }

    @Test
    fun `TokenNotFoundException thrown when returnCode is FAIL_TOKENNOTFOUND`() = runTest {
        val (module, _, httpClient) = makeModule()
        val errorResponse = TokenCommandResponse(returnCode = "FAIL_TOKENNOTFOUND")
        coEvery { httpClient.post<Any, TokenCommandResponse>(any(), any()) } returns errorResponse

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
