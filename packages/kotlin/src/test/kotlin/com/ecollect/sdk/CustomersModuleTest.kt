package com.ecollect.sdk

import com.ecollect.sdk.exceptions.*
import com.ecollect.sdk.modules.CustomersModule
import com.ecollect.sdk.modules.SessionModule
import com.ecollect.sdk.types.GetCustomerIdResponse
import com.ecollect.sdk.types.PaymentInfoType
import com.ecollect.sdk.utils.HttpClient
import io.mockk.*
import kotlinx.coroutines.test.runTest
import org.junit.Assert.*
import org.junit.Test

class CustomersModuleTest {

    private fun makeModule(sessionToken: String = "test-session"): Triple<CustomersModule, SessionModule, HttpClient> {
        val config = Config(etyCode = 123, sessionToken = sessionToken, environment = Environment.TEST)
        val httpClient = mockk<HttpClient>()
        val session = mockk<SessionModule>()
        coEvery { session.getSessionToken() } returns sessionToken
        every { session.invalidate() } just Runs
        coEvery { session.getSessionToken() } returns sessionToken
        val module = CustomersModule(config, httpClient, session)
        return Triple(module, session, httpClient)
    }

    private fun successResponse(customerId: String = "cust-001") = GetCustomerIdResponse(
        returnCode = "SUCCESS",
        customerInfoArray = listOf(
            PaymentInfoType(37, "CustomerId", customerId)
        )
    )

    @Test
    fun `getOrCreateCustomerId returns customerId for new customer`() = runTest {
        val (module, _, httpClient) = makeModule()
        coEvery { httpClient.post<Any, GetCustomerIdResponse>(any(), any()) } returns successResponse("cust-new-001")

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
        val (module, _, httpClient) = makeModule()
        coEvery { httpClient.post<Any, GetCustomerIdResponse>(any(), any()) } returns successResponse("cust-existing-999")

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
        val (module, _, httpClient) = makeModule()
        coEvery { httpClient.post<Any, GetCustomerIdResponse>(any(), any()) } returns successResponse("cust-upd-001")

        val result = module.updateCustomer(
            customerId = "cust-upd-001",
            usermail = "new@example.com"
        )
        assertEquals("cust-upd-001", result)
    }

    @Test
    fun `getOrCreateCustomerId throws CustomerNotFoundException when CustomerId missing in response`() = runTest {
        val (module, _, httpClient) = makeModule()
        coEvery { httpClient.post<Any, GetCustomerIdResponse>(any(), any()) } returns GetCustomerIdResponse(
            returnCode = "SUCCESS",
            customerInfoArray = emptyList()
        )

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
        val (module, _, httpClient) = makeModule()
        coEvery { httpClient.post<Any, GetCustomerIdResponse>(any(), any()) } returns GetCustomerIdResponse(
            returnCode = "FAIL_CARDHOLDERID"
        )

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
        val (module, _, httpClient) = makeModule()
        coEvery { httpClient.post<Any, GetCustomerIdResponse>(any(), any()) } returns GetCustomerIdResponse(
            returnCode = "FAIL_ACCESSDENIED"
        )

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
