import Foundation

/// Handles all payment-related operations: process, pre-authorize, capture, void,
/// and hosted checkout.
public final class PaymentsModule {
    private let config: EcollectConfig
    private let http: HttpClient
    private let session: SessionModule

    init(config: EcollectConfig, http: HttpClient, session: SessionModule) {
        self.config = config
        self.http = http
        self.session = session
    }

    // MARK: - Process payment

    /// Processes an immediate payment (RequestType = 0).
    /// On FAIL_APIEXPIREDSESSION the session is refreshed and the call retried once.
    public func process(_ intent: PaymentIntent) async throws -> CreateTransactionResponse {
        try Validators.validatePaymentIntent(intent)
        return try await sendTransaction(intent, attempt: 0)
    }

    // MARK: - Pre-authorization

    /// Reserves funds without capturing (RequestType = 1).
    public func preAuthorize(_ intent: PaymentIntent) async throws -> CreateTransactionResponse {
        var pre = intent
        pre.requestType = 1
        try Validators.validatePaymentIntent(pre)
        return try await sendTransaction(pre, attempt: 0)
    }

    // MARK: - Capture

    /// Posts (captures) a pre-authorized transaction.
    /// - Parameters:
    ///   - ticketId: The TicketId returned by `preAuthorize`.
    ///   - amount: Final capture amount (may be <= pre-authorized amount).
    ///   - currency: ISO 4217 currency code.
    ///   - srvCode: Optional service code override.
    public func capture(
        ticketId: Int,
        amount: Decimal,
        currency: String,
        srvCode: Int? = nil
    ) async throws -> CreateTransactionResponse {
        let intent = PaymentIntent(
            amount: amount,
            currency: currency,
            referenceArray: [],
            srvCode: srvCode,
            requestType: ticketId  // positive TicketId = capture/post
        )
        return try await sendTransaction(intent, attempt: 0)
    }

    // MARK: - Void pre-authorization

    /// Cancels a pre-authorization before capture.
    /// - Parameter ticketId: The TicketId returned by `preAuthorize`.
    public func void(ticketId: Int, currency: String = "USD") async throws -> CreateTransactionResponse {
        let intent = PaymentIntent(
            amount: 0,
            currency: currency,
            referenceArray: [],
            requestType: -ticketId  // negative TicketId = void
        )
        return try await sendTransaction(intent, attempt: 0)
    }

    // MARK: - Hosted checkout

    /// Creates a transaction and returns the ecollect-hosted checkout URL.
    /// The user is redirected to ecollect to select a payment method and pay.
    public func hostedCheckout(_ intent: PaymentIntent) async throws -> String {
        let response = try await process(intent)
        guard let url = response.eCollectUrl else {
            throw EcollectError.validation(
                "No eCollectUrl returned. Ensure URLRedirect is set and a redirect-based payment system is configured."
            )
        }
        return url
    }

    // MARK: - Private helpers

    private func sendTransaction(
        _ intent: PaymentIntent,
        attempt: Int
    ) async throws -> CreateTransactionResponse {
        let token = try await session.getSessionToken()
        let srvCode = intent.srvCode ?? config.srvCode

        let body = CreateTransactionRequest(
            EntityCode: config.entityCode,
            SessionToken: token,
            SrvCode: srvCode,
            TransValue: intent.amount,
            TransVatValue: intent.vatAmount,
            SrvCurrency: intent.currency,
            URLRedirect: intent.urlRedirect,
            URLResponse: intent.urlResponse,
            LangCode: intent.langCode,
            PaymentSystem: intent.paymentSystem,
            FICode: intent.fiCode,
            Invoice: intent.invoice,
            InvoiceDueDate: intent.invoiceDueDate,
            PolicyCode: intent.policyCode,
            RequestType: intent.requestType,
            ReferenceArray: intent.referenceArray,
            PaymentInfoArray: intent.paymentInfoArray,
            TokenInfoArray: intent.tokenInfoArray,
            SubservicesArray: intent.subservicesArray,
            ChannelInfoArray: intent.channelInfoArray
        )

        let response: CreateTransactionResponse = try await http.post(
            endpoint: "createTransactionPayment",
            body: body
        )

        if response.ReturnCode == "FAIL_APIEXPIREDSESSION" && attempt == 0 {
            try await session.refreshToken()
            return try await sendTransaction(intent, attempt: 1)
        }

        guard response.ReturnCode == "SUCCESS" else {
            throw EcollectError.from(returnCode: response.ReturnCode)
        }

        return response
    }
}
