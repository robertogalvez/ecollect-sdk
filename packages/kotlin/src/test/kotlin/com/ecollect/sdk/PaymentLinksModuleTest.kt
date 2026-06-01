package com.ecollect.sdk

import com.ecollect.sdk.exceptions.ValidationException
import com.ecollect.sdk.modules.PaymentLinkMethod
import com.ecollect.sdk.modules.PaymentLinksModule
import com.ecollect.sdk.modules.PaymentsModule
import com.ecollect.sdk.modules.SessionModule
import com.ecollect.sdk.types.CreateTransactionResponse
import com.ecollect.sdk.types.PaymentIntent
import com.ecollect.sdk.utils.HttpClient
import io.mockk.*
import kotlinx.coroutines.test.runTest
import org.junit.Assert.*
import org.junit.Test

class PaymentLinksModuleTest {

    private val baseIntent = PaymentIntent(
        amount = 100.0,
        currency = "COP",
        referenceArray = listOf("CC", "12345678", "ORDER-001", "Juan Perez", "user@example.com", "3001234567"),
        usermail = "user@example.com",
        cardHolderName = "Juan Perez",
        cardHolderIdType = "CC",
        cardHolderId = "12345678"
    )

    private fun makeModule(): Triple<PaymentLinksModule, PaymentsModule, SessionModule> {
        val config = Config(etyCode = 123, sessionToken = "test-session", environment = Environment.TEST)
        val httpClient = mockk<HttpClient>()
        val session = mockk<SessionModule>()
        coEvery { session.getSessionToken() } returns "test-session"
        val payments = mockk<PaymentsModule>()
        val module = PaymentLinksModule(config, payments, session)
        return Triple(module, payments, session)
    }

    @Test
    fun `generatePaymentLink returns valid URL via email method`() = runTest {
        val (module, payments) = makeModule()
        coEvery { payments.process(any()) } returns CreateTransactionResponse(
            returnCode = "SUCCESS",
            ticketId = 42L,
            eCollectUrl = "https://pay.ecollect.com/link/abc123",
            lifetimeSecs = 3600
        )

        val result = module.generatePaymentLink(baseIntent, PaymentLinkMethod.EMAIL)

        assertEquals(42L, result.ticketId)
        assertEquals("https://pay.ecollect.com/link/abc123", result.eCollectUrl)
        assertEquals(3600, result.lifetimeSecs)
    }

    @Test
    fun `generatePaymentLink with QR method passes lifetime in extra info`() = runTest {
        val (module, payments) = makeModule()
        coEvery { payments.process(any()) } returns CreateTransactionResponse(
            returnCode = "SUCCESS",
            ticketId = 99L,
            eCollectUrl = "https://pay.ecollect.com/link/qr999",
            lifetimeSecs = 7200
        )

        val result = module.generatePaymentLink(baseIntent, PaymentLinkMethod.QR, lifetimeSecs = 7200)

        assertEquals(99L, result.ticketId)
        assertEquals(7200, result.lifetimeSecs)
    }

    @Test
    fun `generatePaymentLink SMS throws if mobileCountryCode is null`() = runTest {
        val (module) = makeModule()
        val intentNoMobile = baseIntent.copy(mobileCountryCode = null, mobileNumber = null)

        try {
            module.generatePaymentLink(intentNoMobile, PaymentLinkMethod.SMS)
            fail("Should throw IllegalArgumentException")
        } catch (e: IllegalArgumentException) {
            assertTrue(e.message?.contains("mobileCountryCode") == true)
        }
    }

    @Test
    fun `generatePaymentLink EMAIL throws if usermail is null`() = runTest {
        val (module) = makeModule()
        val intentNoEmail = baseIntent.copy(usermail = null)

        try {
            module.generatePaymentLink(intentNoEmail, PaymentLinkMethod.EMAIL)
            fail("Should throw IllegalArgumentException")
        } catch (e: IllegalArgumentException) {
            assertTrue(e.message?.contains("usermail") == true)
        }
    }

    @Test
    fun `generatePaymentLink sets paymentSystem to 10`() = runTest {
        val (module, payments) = makeModule()
        val capturedSlot = slot<PaymentIntent>()
        coEvery { payments.process(capture(capturedSlot)) } returns CreateTransactionResponse(
            returnCode = "SUCCESS",
            ticketId = 55L,
            eCollectUrl = "https://pay.ecollect.com/link/55",
            lifetimeSecs = 3600
        )

        module.generatePaymentLink(baseIntent, PaymentLinkMethod.EMAIL)

        assertEquals("10", capturedSlot.captured.paymentSystem)
    }
}
