package com.ecollect.sdk.modules

import com.ecollect.sdk.Config
import com.ecollect.sdk.exceptions.*
import com.ecollect.sdk.types.*
import com.ecollect.sdk.utils.HttpClient
import com.ecollect.sdk.utils.Validators

class TokensModule(
    private val config: Config,
    private val httpClient: HttpClient,
    private val sessionModule: SessionModule
) {
    /**
     * Save a card for future payments (SAVE command).
     * Returns the TokenId.
     */
    suspend fun save(
        cardNumber: String,
        expirationDate: String,
        paymentSystem: String,
        fiCode: String,
        cardHolderName: String,
        cardHolderIdType: String,
        cardHolderId: String,
        usermail: String,
        mobileCountryCode: String,
        mobileNumber: String,
        accountType: String = "0",
        customerId: String? = null
    ): TokenCommandResponse {
        Validators.validateCardNumber(cardNumber)
        Validators.validateExpirationDate(expirationDate)

        val tokenInfoArray = buildTokenInfoArray(
            command = "SAVE",
            cardNumber = cardNumber,
            expirationDate = expirationDate,
            paymentSystem = paymentSystem,
            fiCode = fiCode,
            accountType = accountType,
            cardHolderName = cardHolderName,
            cardHolderIdType = cardHolderIdType,
            cardHolderId = cardHolderId,
            usermail = usermail,
            mobileCountryCode = mobileCountryCode,
            mobileNumber = mobileNumber,
            customerId = customerId
        )
        return executeCommand("SAVE", tokenInfoArray)
    }

    /**
     * Get a temporary token for a one-time payment (GET command).
     */
    suspend fun get(
        cardNumber: String,
        expirationDate: String,
        paymentSystem: String,
        fiCode: String,
        cardHolderName: String,
        cardHolderIdType: String,
        cardHolderId: String,
        usermail: String,
        mobileCountryCode: String,
        mobileNumber: String,
        accountType: String = "0",
        customerId: String? = null
    ): TokenCommandResponse {
        Validators.validateCardNumber(cardNumber)
        Validators.validateExpirationDate(expirationDate)

        val tokenInfoArray = buildTokenInfoArray(
            command = "GET",
            cardNumber = cardNumber,
            expirationDate = expirationDate,
            paymentSystem = paymentSystem,
            fiCode = fiCode,
            accountType = accountType,
            cardHolderName = cardHolderName,
            cardHolderIdType = cardHolderIdType,
            cardHolderId = cardHolderId,
            usermail = usermail,
            mobileCountryCode = mobileCountryCode,
            mobileNumber = mobileNumber,
            customerId = customerId
        )
        return executeCommand("GET", tokenInfoArray)
    }

    /**
     * Get a hold token for pre-authorization (HOLD command).
     */
    suspend fun hold(
        cardNumber: String,
        expirationDate: String,
        paymentSystem: String,
        fiCode: String,
        cardHolderName: String,
        cardHolderIdType: String,
        cardHolderId: String,
        usermail: String,
        mobileCountryCode: String,
        mobileNumber: String,
        accountType: String = "0",
        customerId: String? = null
    ): TokenCommandResponse {
        Validators.validateCardNumber(cardNumber)
        Validators.validateExpirationDate(expirationDate)

        val tokenInfoArray = buildTokenInfoArray(
            command = "HOLD",
            cardNumber = cardNumber,
            expirationDate = expirationDate,
            paymentSystem = paymentSystem,
            fiCode = fiCode,
            accountType = accountType,
            cardHolderName = cardHolderName,
            cardHolderIdType = cardHolderIdType,
            cardHolderId = cardHolderId,
            usermail = usermail,
            mobileCountryCode = mobileCountryCode,
            mobileNumber = mobileNumber,
            customerId = customerId
        )
        return executeCommand("HOLD", tokenInfoArray)
    }

    /**
     * Delete a saved card token (REMOVE command).
     */
    suspend fun delete(
        tokenId: String,
        paymentSystem: String,
        fiCode: String,
        cardHolderId: String,
        usermail: String? = null
    ): TokenCommandResponse {
        val tokenInfoArray = mutableListOf(
            PaymentInfoType(1, "TokenId", tokenId),
            PaymentInfoType(2, "PaymentSystem", paymentSystem),
            PaymentInfoType(9, "FiCode", fiCode),
            PaymentInfoType(19, "CardHolderId", cardHolderId)
        )
        usermail?.let { tokenInfoArray.add(PaymentInfoType(6, "Usermail", it)) }
        return executeCommand("REMOVE", tokenInfoArray)
    }

    /**
     * Update a saved card's expiration date (UPDATE command).
     */
    suspend fun update(
        tokenId: String,
        expirationDate: String,
        paymentSystem: String,
        fiCode: String,
        cardHolderId: String
    ): TokenCommandResponse {
        Validators.validateExpirationDate(expirationDate)
        val tokenInfoArray = listOf(
            PaymentInfoType(1, "TokenId", tokenId),
            PaymentInfoType(2, "PaymentSystem", paymentSystem),
            PaymentInfoType(4, "ExpirationDate", expirationDate),
            PaymentInfoType(9, "FiCode", fiCode),
            PaymentInfoType(19, "CardHolderId", cardHolderId)
        )
        return executeCommand("UPDATE", tokenInfoArray)
    }

    /**
     * List all saved cards for a user.
     */
    suspend fun list(usermail: String, cardHolderId: String): QueryTokenResponse {
        val token = sessionModule.getSessionToken()
        val request = QueryTokenRequest(
            entityCode = config.etyCode,
            sessionToken = token,
            tokenInfoArray = listOf(
                PaymentInfoType(6, "Usermail", usermail),
                PaymentInfoType(19, "CardHolderId", cardHolderId)
            )
        )
        val url = "${config.baseUrl}queryToken"
        val response: QueryTokenResponse = httpClient.post(url, request)
        return when (response.returnCode) {
            "SUCCESS", "NO_RECORDS", "SUCCESS_ALREADY_CREATED" -> response
            "FAIL_APIEXPIREDSESSION" -> {
                sessionModule.invalidate()
                val newToken = sessionModule.getSessionToken()
                val retryResponse: QueryTokenResponse = httpClient.post(
                    url,
                    request.copy(sessionToken = newToken)
                )
                retryResponse
            }
            "FAIL_INVALIDENTITYCODE" -> throw InvalidConfigException("EntityCode is invalid")
            "FAIL_ACCESSDENIED" -> throw AuthenticationException("Session token authentication failed")
            "FAIL_SYSTEM" -> throw NetworkRetryableException("ecollect system error querying tokens")
            else -> response
        }
    }

    private suspend fun executeCommand(
        command: String,
        tokenInfoArray: List<PaymentInfoType>
    ): TokenCommandResponse {
        val token = sessionModule.getSessionToken()
        val request = TokenCommandRequest(
            entityCode = config.etyCode,
            sessionToken = token,
            command = command,
            tokenInfoArray = tokenInfoArray
        )
        val url = "${config.baseUrl}tokenCommand"
        val response: TokenCommandResponse = httpClient.post(url, request)
        return when (response.returnCode) {
            "SUCCESS" -> response
            "FAIL_APIEXPIREDSESSION" -> {
                sessionModule.invalidate()
                val newToken = sessionModule.getSessionToken()
                val retryResponse: TokenCommandResponse = httpClient.post(
                    url,
                    request.copy(sessionToken = newToken)
                )
                retryResponse
            }
            "FAIL_INVALIDENTITYCODE" -> throw InvalidConfigException("EntityCode is invalid")
            "FAIL_ACCESSDENIED" -> throw AuthenticationException("Session token authentication failed")
            "FAIL_INVALIDCREDITCARD" -> throw InvalidCardException("Card number failed Luhn validation")
            "FAIL_INVALIDEXPIRATIONDATE" -> throw InvalidCardException("Expiration date is invalid")
            "FAIL_TOKENNOTFOUND" -> throw TokenNotFoundException("TokenId not found: command=$command")
            "FAIL_SYSTEM" -> throw NetworkRetryableException("ecollect system error during tokenCommand")
            else -> response
        }
    }

    private fun buildTokenInfoArray(
        command: String,
        cardNumber: String,
        expirationDate: String,
        paymentSystem: String,
        fiCode: String,
        accountType: String,
        cardHolderName: String,
        cardHolderIdType: String,
        cardHolderId: String,
        usermail: String,
        mobileCountryCode: String,
        mobileNumber: String,
        customerId: String?
    ): List<PaymentInfoType> {
        val list = mutableListOf(
            PaymentInfoType(0, "CardNumber", cardNumber),
            PaymentInfoType(2, "PaymentSystem", paymentSystem),
            PaymentInfoType(4, "ExpirationDate", expirationDate),
            PaymentInfoType(9, "FiCode", fiCode),
            PaymentInfoType(22, "AccountType", accountType)
        )
        if (customerId != null) {
            list.add(PaymentInfoType(attributeCode = 36, attributeDesc = "CustomerId", attributeValue = customerId))
        } else {
            list.addAll(listOf(
                PaymentInfoType(6, "Usermail", usermail),
                PaymentInfoType(7, "MobileCountryCode", mobileCountryCode),
                PaymentInfoType(8, "MobileNumber", mobileNumber),
                PaymentInfoType(17, "CardHolderName", cardHolderName),
                PaymentInfoType(18, "CardHolderIdType", cardHolderIdType),
                PaymentInfoType(19, "CardHolderId", cardHolderId)
            ))
        }
        return list
    }
}
