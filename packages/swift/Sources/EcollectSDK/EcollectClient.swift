import Foundation

/// Main entry point for the ecollect iOS/Swift SDK.
///
/// Server-side initialization (ApiKey — never put this in a mobile app):
/// ```swift
/// let client = EcollectClient(
///     apiKey: "your-private-api-key",
///     etyCode: 123,
///     environment: .test
/// )
/// ```
///
/// Mobile/client-side initialization (SessionToken obtained from your backend):
/// ```swift
/// let client = EcollectClient.fromSessionToken(
///     "session-token-from-backend",
///     etyCode: 123,
///     environment: .test
/// )
/// ```
///
/// Usage:
/// ```swift
/// let payment = try await client.payments.process(paymentIntent)
/// let cards   = try await client.tokens.list(usermail: "u@e.com", cardHolderId: "12345678")
/// ```
public final class EcollectClient {

    // MARK: - Public modules

    /// Session management: getSessionToken, cache, auto-refresh.
    public let session: SessionModule
    /// Payment operations: process, preAuthorize, capture, void, hostedCheckout.
    public let payments: PaymentsModule
    /// Card tokenization: save, get, hold, delete, update, list.
    public let tokens: TokensModule
    /// Webhook verification: verifyWebhookSignature, confirmWebhook.
    public let webhooks: WebhooksModule
    /// Transaction reconciliation: getTransactionStatus, reconciliate (polling).
    public let reconciliation: ReconciliationModule
    /// Customer identity management: getOrCreateCustomerId.
    public let customers: CustomersModule
    /// Payment systems catalog: getPaymentSystems.
    public let paymentSystems: PaymentSystemsModule
    /// Payment link generation (email, SMS, QR).
    public let paymentLinks: PaymentLinksModule

    // MARK: - Stored config

    public let config: EcollectConfig

    // MARK: - Initialization (server-side)

    /// Initializes the client with an ApiKey.
    /// - Warning: The ApiKey is a private credential. Never embed it in a mobile app binary.
    ///   Use `fromSessionToken(_:etyCode:environment:srvCode:)` for mobile apps.
    public init(
        apiKey: String,
        etyCode: Int,
        environment: EcollectEnvironment = .test,
        srvCode: Int? = nil
    ) {
        let cfg = EcollectConfig(
            apiKey: apiKey,
            entityCode: etyCode,
            environment: environment,
            srvCode: srvCode
        )
        self.config = cfg
        let http = HttpClient(baseURL: cfg.baseURL)
        let sessionModule = SessionModule(config: cfg, http: http)
        self.session = sessionModule
        self.payments = PaymentsModule(config: cfg, http: http, session: sessionModule)
        self.tokens = TokensModule(config: cfg, http: http, session: sessionModule)
        self.webhooks = WebhooksModule(config: cfg, http: http, session: sessionModule)
        self.reconciliation = ReconciliationModule(config: cfg, http: http, session: sessionModule)
        self.customers = CustomersModule(config: cfg, http: http, session: sessionModule)
        self.paymentSystems = PaymentSystemsModule(config: cfg, http: http, session: sessionModule)
        self.paymentLinks = PaymentLinksModule(config: cfg, http: http, session: sessionModule)
    }

    // MARK: - Initialization (mobile / session-token only)

    /// Creates a client pre-loaded with a SessionToken obtained from the merchant backend.
    /// The ApiKey is never stored in the app — this is the recommended mobile initialization.
    public static func fromSessionToken(
        _ sessionToken: String,
        etyCode: Int,
        environment: EcollectEnvironment = .test,
        srvCode: Int? = nil
    ) -> EcollectClient {
        let cfg = EcollectConfig(
            sessionToken: sessionToken,
            entityCode: etyCode,
            environment: environment,
            srvCode: srvCode
        )
        return EcollectClient(config: cfg)
    }

    // MARK: - Private designated init

    private init(config: EcollectConfig) {
        self.config = config
        let http = HttpClient(baseURL: config.baseURL)
        let sessionModule = SessionModule(config: config, http: http)
        self.session = sessionModule
        self.payments = PaymentsModule(config: config, http: http, session: sessionModule)
        self.tokens = TokensModule(config: config, http: http, session: sessionModule)
        self.webhooks = WebhooksModule(config: config, http: http, session: sessionModule)
        self.reconciliation = ReconciliationModule(config: config, http: http, session: sessionModule)
        self.customers = CustomersModule(config: config, http: http, session: sessionModule)
        self.paymentSystems = PaymentSystemsModule(config: config, http: http, session: sessionModule)
        self.paymentLinks = PaymentLinksModule(config: config, http: http, session: sessionModule)
    }
}
