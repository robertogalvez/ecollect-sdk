package com.ecollect.sdk

import com.ecollect.sdk.exceptions.*
import com.ecollect.sdk.modules.CustomersModule
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

class CustomersModuleTest {

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

    private fun makeModule(sessionToken: String = "test-session"): CustomersModule {
        val config = makeConfig(sessionToken)
        val session = mockk<SessionModule>()
        coEvery { session.getSessionToken() } returns sessionToken
        every { session.invalidate() } just Runs
        return CustomersModule(config, httpClient, session)
    }

    private fun enqueueSuccess(customerId: String = "cust-001") {
        mockWebServer.enqueue(
            MockResponse()
                .setBody("""{"ReturnCode":"SUCCESS","CustomerInfoArray":[{"AttributeCode":37,"AttributeDesc":"CustomerId","AttributeValue":"$customerId"}]}""")
                .setResponseCode(200)
        )
    }

    @Test
    fun `getOrCreateCustomerId returns customerId for new customer`() = runTest {
        enqueueSuccess("cust-new-001")
        val module = makeModule()

        val result = module.getOrCreateCustomerId(
            usermail = "user@example.com",
            cardHolderId = "12345678",
            cardHolderName = "Juan Perez",
            cardHolderIdType = "CC",
            mobileCountryCode = "57",
            mobileNumber = "3001234567"
        )
        assertEquals("cust-new-001", result)
    }

    @Test
    fun `getOrCreateCustomerId returns same customerId for existing customer`() = runTest {
        enqueueSuccess("cust-existing-999")
        val module = makeModule()

        val result = module.getOrCreateCustomerId(
            usermail = "user@example.com",
            cardHolderId = "12345678",
            cardHolderName = "Juan Perez",
            cardHolderIdType = "CC",
            mobileCountryCode = "57",
            mobileNumber = "3001234567"
        )
        assertEquals("cust-existing-999", result)
    }

    @Test
    fun `updateCustomer returns customerId on success`() = runTest {
        enqueueSuccess("cust-upd-001")
        val module = makeModule()

        val result = module.updateCustomer(
            customerId = "cust-upd-001",
            usermail = "new@example.com"
        )
        assertEquals("cust-upd-001", result)
    }

    @Test
    fun `getOrCreateCustomerId throws CustomerNotFoundException when CustomerId missing in response`() = runTest {
        mockWebServer.enqueue(
            MockResponse()
                .setBody("""{"ReturnCode":"SUCCESS","CustomerInfoArray":[]}""")
                .setResponseCode(200)
        )
        val module = makeModule()

        try {
            module.getOrCreateCustomerId(
                usermail = "user@example.com",
                cardHolderId = "12345678",
                cardHolderName = "Juan Perez",
                cardHolderIdType = "CC",
                mobileCountryCode = "57",
                mobileNumber = "3001234567"
            )
            fail("Should throw CustomerNotFoundException")
        } catch (e: CustomerNotFoundException) {
            assertNotNull(e.message)
        }
    }

    @Test
    fun `getOrCreateCustomerId throws ValidationException for invalid card holder ID`() = runTest {
        mockWebServer.enqueue(
            MockResponse()
                .setBody("""{"ReturnCode":"FAIL_CARDHOLDERID"}""")
                .setResponseCode(200)
        )
        val module = makeModule()

        try {
            module.getOrCreateCustomerId(
                usermail = "user@example.com",
                cardHolderId = "bad-id",
                cardHolderName = "Juan Perez",
                cardHolderIdType = "CC",
                mobileCountryCode = "57",
                mobileNumber = "3001234567"
            )
            fail("Should throw ValidationException")
        } catch (e: ValidationException) {
            assertNotNull(e.message)
        }
    }

    @Test
    fun `getOrCreateCustomerId throws AuthenticationException on FAIL_ACCESSDENIED`() = runTest {
        mockWebServer.enqueue(
            MockResponse()
                .setBody("""{"ReturnCode":"FAIL_ACCESSDENIED"}""")
                .setResponseCode(200)
        )
        val module = makeModule()

        try {
            module.getOrCreateCustomerId(
                usermail = "user@example.com",
                cardHolderId = "12345678",
                cardHolderName = "Juan Perez",
                cardHolderIdType = "CC",
                mobileCountryCode = "57",
                mobileNumber = "3001234567"
            )
            fail("Should throw AuthenticationException")
        } catch (e: AuthenticationException) {
            assertNotNull(e.message)
        }
    }
}
