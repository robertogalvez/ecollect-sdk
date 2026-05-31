import Foundation

/// Token commands supported by ecollect's tokenCommand API.
public enum TokenCommand: String {
    /// Temporary token for a one-time payment (not saved persistently).
    case get = "GET"
    /// Save card permanently for future payments.
    case save = "SAVE"
    /// Delete a saved card.
    case remove = "REMOVE"
    /// Update expiration date of a saved card.
    case update = "UPDATE"
    /// Temporary token reserved for a pre-authorization.
    case hold = "HOLD"
}

/// Manages credit card tokenization operations.
public final class TokensModule {
    private let config: EcollectConfig
    private let http: HttpClient
    private let session: SessionModule

    init(config: EcollectConfig, http: HttpClient, session: SessionModule) {
        self.config = config
        self.http = http
        self.session = session
    }

    // MARK: - Save card

    /// Tokenizes and saves a card for future use.
    /// - Parameter tokenInfoArray: Card details as PaymentInfoType attributes.
    public func save(tokenInfoArray: [PaymentInfoType]) async throws -> TokenCommandResponse {
        return try await execute(command: .save, tokenInfoArray: tokenInfoArray)
    }

    // MARK: - Get temporary token

    /// Obtains a temporary token for a single payment (not saved).
    public func get(tokenInfoArray: [PaymentInfoType]) async throws -> TokenCommandResponse {
        return try await execute(command: .get, tokenInfoArray: tokenInfoArray)
    }

    // MARK: - Hold token (pre-authorization)

    /// Obtains a temporary token reserved for a pre-authorization.
    public func hold(tokenInfoArray: [PaymentInfoType]) async throws -> TokenCommandResponse {
        return try await execute(command: .hold, tokenInfoArray: tokenInfoArray)
    }

    // MARK: - Delete card

    /// Removes a saved card by tokenId.
    public func delete(
        tokenId: String,
        usermail: String,
        cardHolderId: String
    ) async throws -> TokenCommandResponse {
        let tokenInfoArray: [PaymentInfoType] = [
            PaymentInfoType(code: AttributeCode.tokenId, desc: "TokenId", value: tokenId),
            PaymentInfoType(code: AttributeCode.usermail, desc: "Usermail", value: usermail),
            PaymentInfoType(code: AttributeCode.cardHolderId, desc: "CardHolderId", value: cardHolderId),
        ]
        return try await execute(command: .remove, tokenInfoArray: tokenInfoArray)
    }

    // MARK: - Update card

    /// Updates a saved card's expiration date.
    public func update(tokenId: String, newExpiration: String) async throws -> TokenCommandResponse {
        let tokenInfoArray: [PaymentInfoType] = [
            PaymentInfoType(code: AttributeCode.tokenId, desc: "TokenId", value: tokenId),
            PaymentInfoType(code: AttributeCode.expirationDate, desc: "ExpirationDate", value: newExpiration),
        ]
        return try await execute(command: .update, tokenInfoArray: tokenInfoArray)
    }

    // MARK: - List saved cards

    /// Lists all tokenized cards for a user identified by email and document ID.
    public func list(usermail: String, cardHolderId: String) async throws -> [SavedCard] {
        let token = try await session.getSessionToken()
        let tokenInfoArray: [PaymentInfoType] = [
            PaymentInfoType(code: AttributeCode.usermail, desc: "Usermail", value: usermail),
            PaymentInfoType(code: AttributeCode.cardHolderId, desc: "CardHolderId", value: cardHolderId),
        ]
        let body = QueryTokenRequest(
            EntityCode: config.entityCode,
            SessionToken: token,
            TokenInfoArray: tokenInfoArray
        )
        let response: QueryTokenResponse = try await http.post(endpoint: "queryToken", body: body)

        switch response.ReturnCode {
        case "SUCCESS", "SUCCESS_ALREADY_CREATED":
            return (response.TokenArray ?? []).compactMap { tokenType in
                SavedCard(
                    tokenInfoArray: tokenType.TokenInfoArray ?? [],
                    status: tokenType.TokenStatus,
                    lifetimeSecs: tokenType.LifetimeSecs
                )
            }
        case "NO_RECORDS":
            return []
        default:
            throw EcollectError.from(returnCode: response.ReturnCode)
        }
    }

    // MARK: - Private helpers

    private func execute(
        command: TokenCommand,
        tokenInfoArray: [PaymentInfoType],
        attempt: Int = 0
    ) async throws -> TokenCommandResponse {
        // Note: ecollect requires a fresh session token for each tokenCommand call.
        try await session.refreshToken()
        let token = try await session.getSessionToken()

        // Validate card number if present (Luhn check)
        if command == .get || command == .save || command == .hold {
            if let cardAttr = tokenInfoArray.first(where: { $0.AttributeCode == AttributeCode.cardNumber }) {
                guard Validators.luhnCheck(cardAttr.AttributeValue) else {
                    throw EcollectError.invalidCard(
                        "Card number '\(cardAttr.AttributeValue.prefix(4))****' failed Luhn check"
                    )
                }
            }
        }

        let body = TokenCommandRequest(
            EntityCode: config.entityCode,
            SessionToken: token,
            Command: command.rawValue,
            TokenInfoArray: tokenInfoArray
        )
        let response: TokenCommandResponse = try await http.post(endpoint: "tokenCommand", body: body)

        if response.ReturnCode == "FAIL_APIEXPIREDSESSION" && attempt == 0 {
            try await session.refreshToken()
            return try await execute(command: command, tokenInfoArray: tokenInfoArray, attempt: 1)
        }

        guard response.ReturnCode == "SUCCESS" else {
            throw EcollectError.from(returnCode: response.ReturnCode)
        }
        return response
    }
}
