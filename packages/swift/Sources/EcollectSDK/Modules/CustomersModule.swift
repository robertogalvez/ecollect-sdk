import Foundation

/// Manages ecollect customer identities for persistent tokenization.
/// Using a CustomerId reduces the payload when a customer tokenizes multiple cards.
public final class CustomersModule {
    private let config: EcollectConfig
    private let http: HttpClient
    private let session: SessionModule

    init(config: EcollectConfig, http: HttpClient, session: SessionModule) {
        self.config = config
        self.http = http
        self.session = session
    }

    // MARK: - Get or create customer

    /// Retrieves an existing CustomerId for this customer, or creates one if not found.
    /// - Parameters:
    ///   - usermail: Customer's email address.
    ///   - cardHolderId: Customer's document number.
    ///   - cardHolderName: Customer's full name.
    ///   - cardHolderIdType: Document type (CC, NIT, CI, RFC, etc.).
    ///   - mobileCountryCode: Mobile country code (e.g. "57", "52", "1").
    ///   - mobileNumber: Mobile phone number.
    /// - Returns: The ecollect CustomerId string.
    public func getOrCreateCustomerId(
        usermail: String,
        cardHolderId: String,
        cardHolderName: String,
        cardHolderIdType: String,
        mobileCountryCode: String,
        mobileNumber: String
    ) async throws -> String {
        guard Validators.isValidEmail(usermail) else {
            throw EcollectError.validation("Invalid email format: \(usermail)")
        }

        let token = try await session.getSessionToken()
        let customerInfoArray: [PaymentInfoType] = [
            PaymentInfoType(code: AttributeCode.cardHolderId,    desc: "CardHolderId",    value: cardHolderId),
            PaymentInfoType(code: AttributeCode.usermail,        desc: "Usermail",        value: usermail),
            PaymentInfoType(code: AttributeCode.cardHolderName,  desc: "CardHolderName",  value: cardHolderName),
            PaymentInfoType(code: AttributeCode.cardHolderIdType,desc: "CardHolderIdType",value: cardHolderIdType),
            PaymentInfoType(code: AttributeCode.mobileCountryCode, desc: "MobileCountryCode", value: mobileCountryCode),
            PaymentInfoType(code: AttributeCode.mobileNumber,    desc: "MobileNumber",    value: mobileNumber),
        ]

        let body = GetCustomerIdRequest(
            EntityCode: config.entityCode,
            SessionToken: token,
            CustomerInfoArray: customerInfoArray
        )
        let response: GetCustomerIdResponse = try await http.post(endpoint: "getCustomerId", body: body)

        guard response.ReturnCode == "SUCCESS" else {
            throw EcollectError.from(returnCode: response.ReturnCode)
        }

        guard let customerId = response.CustomerInfoArray?
            .first(where: { $0.AttributeCode == AttributeCode.customerId })?
            .AttributeValue else {
            throw EcollectError.apiError(code: response.ReturnCode, message: "CustomerId not found in response")
        }

        return customerId
    }
}
