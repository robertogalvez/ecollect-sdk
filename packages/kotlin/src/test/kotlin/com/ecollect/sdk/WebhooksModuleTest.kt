package com.ecollect.sdk

import com.ecollect.sdk.exceptions.AuthenticationException
import com.ecollect.sdk.exceptions.WebhookValidationException
import com.ecollect.sdk.modules.SessionModule
import com.ecollect.sdk.modules.WebhooksModule
import com.ecollect.sdk.types.GetTransactionResponse
import com.ecollect.sdk.utils.HttpClient
import io.mockk.*
import kotlinx.coroutines.test.runTest
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import org.junit.After
import org.junit.Assert.*
import org.junit.Before
import org.junit.Test
import javax.crypto.Mac
import javax.crypto.spec.SecretKeySpec

class WebhooksModuleTest {

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

    private fun makeConfig(sessionToken: String = "active-session-token") = Config(
        etyCode = 123,
        sessionToken = sessionToken,
        environment = Environment.TEST,
        testBaseUrl = mockWebServer.url("/").toString()
    )

    private fun makeModule(sessionToken: String = "active-session-token"): WebhooksModule {
        val config = makeConfig(sessionToken)
        val session = mockk<SessionModule>()
        coEvery { session.getSessionToken() } returns sessionToken
        every { session.invalidate() } just Runs
        return WebhooksModule(config, httpClient, session)
    }

    private fun hmacSha256Hex(message: String, secret: String): String {
        val mac = Mac.getInstance("HmacSHA256")
        mac.init(SecretKeySpec(secret.toByteArray(), "HmacSHA256"))
        return mac.doFinal(message.toByteArray()).joinToString("") { "%02x".format(it) }
    }

    // ── verifyWebhookSignature — HMAC path ───────────────────────────────────

    @Test
    fun `verifyWebhookSignature returns true with valid HMAC`() = runTest {
        // verifyWebhookSignature calls verifyViaApi after HMAC check passes
        mockWebServer.enqueue(MockResponse().setBody("""{"ReturnCode":"SUCCESS"}""").setResponseCode(200))

        val rawBody = """{"ReturnCode":"SUCCESS"}"""
        val secret  = "webhook-secret"
        val sig     = hmacSha256Hex(rawBody, secret)
        val payload = GetTransactionResponse(returnCode = "SUCCESS", sessionToken = "wh-session")

        val module = makeModule()
        val result = module.verifyWebhookSignature(payload, webhookSecret = secret, rawBody = rawBody, signature = sig)
        assertTrue(result)
    }

    @Test
    fun `verifyWebhookSignature throws WebhookValidationException for bad HMAC`() = runTest {
        // Bad HMAC is rejected before any HTTP call — no server response needed
        val payload = GetTransactionResponse(returnCode = "SUCCESS", sessionToken = "wh-session")
        val module = makeModule()

        try {
            module.verifyWebhookSignature(
                payload, webhookSecret = "secret", rawBody = """{"ok":true}""", signature = "bad-sig"
            )
            fail("Expected WebhookValidationException")
        } catch (e: WebhookValidationException) {
            assertTrue(e.message?.contains("HMAC") == true)
        }
    }

    @Test
    fun `verifyWebhookSignature throws when SessionToken missing from payload`() = runTest {
        // SessionToken check happens before HTTP call — no server response needed
        val payload = GetTransactionResponse(returnCode = "SUCCESS", sessionToken = null)
        val module = makeModule()

        try {
            module.verifyWebhookSignature(payload)
            fail("Expected WebhookValidationException")
        } catch (e: WebhookValidationException) {
            assertTrue(e.message?.contains("SessionToken") == true)
        }
    }

    // ── confirmWebhook ────────────────────────────────────────────────────────

    @Test
    fun `confirmWebhook returns true when API returns SUCCESS`() = runTest {
        mockWebServer.enqueue(MockResponse().setBody("""{"ReturnCode":"SUCCESS"}""").setResponseCode(200))
        val module = makeModule()

        val result = module.confirmWebhook("wh-session-token", ticketIdToVerify = 12345L)
        assertTrue(result)
    }

    @Test
    fun `confirmWebhook throws WebhookValidationException for FAIL_SESSIONNOTFOUND`() = runTest {
        mockWebServer.enqueue(MockResponse().setBody("""{"ReturnCode":"FAIL_SESSIONNOTFOUND"}""").setResponseCode(200))
        val module = makeModule()

        try {
            module.confirmWebhook("bad-token")
            fail("Expected WebhookValidationException")
        } catch (e: WebhookValidationException) {
            assertTrue(e.message?.contains("does not exist") == true)
        }
    }

    @Test
    fun `confirmWebhook throws WebhookValidationException for FAIL_TICKETIDNOTMATCH`() = runTest {
        mockWebServer.enqueue(MockResponse().setBody("""{"ReturnCode":"FAIL_TICKETIDNOTMATCH"}""").setResponseCode(200))
        val module = makeModule()

        try {
            module.confirmWebhook("wh-token", ticketIdToVerify = 999L)
            fail("Expected WebhookValidationException")
        } catch (e: WebhookValidationException) {
            assertTrue(e.message?.contains("TicketId") == true)
        }
    }

    @Test
    fun `confirmWebhook throws AuthenticationException for FAIL_ACCESSDENIED`() = runTest {
        mockWebServer.enqueue(MockResponse().setBody("""{"ReturnCode":"FAIL_ACCESSDENIED"}""").setResponseCode(200))
        val module = makeModule()

        try {
            module.confirmWebhook("wh-token")
            fail("Expected AuthenticationException")
        } catch (e: AuthenticationException) {
            assertNotNull(e)
        }
    }
}
