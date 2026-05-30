import Foundation

/// Delivery method for payment links.
public enum PaymentLinkMethod {
    /// Send link via email (default).
    case email(address: String)
    /// Send link via SMS.
    case sms(countryCode: String, number: String)
    /// Generate a QR / raw link with a custom lifetime.
    case qr(lifetimeSecs: Int)
}

/// Result of generating a payment link.
public struct PaymentLinkResult {
    /// The ecollect-hosted checkout URL.
    public let eCollectUrl: String
    /// The TicketId for later reconciliation.
    public let ticketId: Int
    /// Seconds until the link expires.
    public let lifetimeSecs: Int
    /// Computed expiration date.
    public var expiresAt: Date { Date().addingTimeInterval(TimeInterval(lifetimeSecs)) }
}

/// Generates payment links sent via email, SMS, or QR code.
/// Uses PaymentSystem = "10" (Link de Pagos) on ecollect.
public final class PaymentLinksModule {
    private let config: EcollectConfig
    private let http: HttpClient
    private let session: SessionModule

    init(config: EcollectConfig, http: HttpClient, session: SessionModule) {
        self.config = config
        self.http = http
        self.session = session
    }

    /// Generates a payment link using the specified delivery method.
    /// - Parameters:
    ///   - intent: The base PaymentIntent. `paymentSystem` is overridden to "10".
    ///   - method: How the link should be delivered (email, SMS, or QR).
    public func generatePaymentLink(
        intent: PaymentIntent,
        method: PaymentLinkMethod
    ) async throws -> PaymentLinkResult {
        var modified = intent
        modified.paymentSystem = "10"  // Link de Pagos

        var extraInfo = modified.paymentInfoArray ?? []

        switch method {
        case .email(let address):
            extraInfo.append(
                PaymentInfoType(code: AttributeCode.usermail, desc: "Usermail", value: address)
            )
        case .sms(let countryCode, let number):
            extraInfo.append(
                PaymentInfoType(code: AttributeCode.mobileCountryCode, desc: "MobileCountryCode", value: countryCode)
            )
            extraInfo.append(
                PaymentInfoType(code: AttributeCode.mobileNumber, desc: "MobileNumber", value: number)
            )
        case .qr(let secs):
            extraInfo.append(
                PaymentInfoType(code: AttributeCode.lifetimeSecs, desc: "LifetimeSecs", value: String(secs))
            )
        }

        modified.paymentInfoArray = extraInfo

        let token = try await session.getSessionToken()
        let srvCode = modified.srvCode ?? config.srvCode

        let body = CreateTransactionRequest(
            EntityCode: config.entityCode,
            SessionToken: token,
            SrvCode: srvCode,
            TransValue: modified.amount,
            TransVatValue: modified.vatAmount,
            SrvCurrency: modified.currency,
            URLRedirect: modified.urlRedirect,
            URLResponse: modified.urlResponse,
            LangCode: modified.langCode,
            PaymentSystem: modified.paymentSystem,
            FICode: modified.fiCode,
            Invoice: modified.invoice,
            InvoiceDueDate: modified.invoiceDueDate,
            PolicyCode: modified.policyCode,
            RequestType: modified.requestType,
            ReferenceArray: modified.referenceArray,
            PaymentInfoArray: modified.paymentInfoArray,
            TokenInfoArray: modified.tokenInfoArray,
            SubservicesArray: modified.subservicesArray,
            ChannelInfoArray: modified.channelInfoArray
        )
        let response: CreateTransactionResponse = try await http.post(
            endpoint: "createTransactionPayment",
            body: body
        )
        guard response.ReturnCode == "SUCCESS",
              let ticketId = response.TicketId,
              let url = response.eCollectUrl else {
            throw EcollectError.from(returnCode: response.ReturnCode,
                                     context: "generatePaymentLink")
        }
        return PaymentLinkResult(
            eCollectUrl: url,
            ticketId: ticketId,
            lifetimeSecs: response.LifetimeSecs ?? 3600
        )
    }
}
