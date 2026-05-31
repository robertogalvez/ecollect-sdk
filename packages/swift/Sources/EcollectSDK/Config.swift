import Foundation

/// The deployment environment for the ecollect SDK.
public enum EcollectEnvironment {
    case test
    case production

    /// Base URL for most API calls.
    var baseURL: String {
        switch self {
        case .test:
            return "https://test1.e-collect.com/app_express/api/"
        case .production:
            return "https://www.e-collect.com/app_Express/api/"
        }
    }

    /// URL used exclusively for GetTransactionInformation in production.
    var transactionInfoURL: String {
        switch self {
        case .test:
            return "https://test1.e-collect.com/app_express/api/getTransactionInformation"
        case .production:
            return "https://m.e-collect.com/app_Express/api/GetTransactionInformation"
        }
    }
}

/// Configuration for the EcollectClient.
public struct EcollectConfig {
    /// Merchant entity code assigned by ecollect.
    public let entityCode: Int
    /// Private API key — only use on the server side. Never embed in a mobile app.
    public let apiKey: String?
    /// Session token obtained from the backend. Used for mobile/client-side initialization.
    public let sessionToken: String?
    /// Optional default service code.
    public let srvCode: Int?
    /// Deployment environment.
    public let environment: EcollectEnvironment

    /// Full client init (server-side only — apiKey stays on your backend).
    public init(
        apiKey: String,
        entityCode: Int,
        environment: EcollectEnvironment = .test,
        srvCode: Int? = nil
    ) {
        self.apiKey = apiKey
        self.entityCode = entityCode
        self.environment = environment
        self.srvCode = srvCode
        self.sessionToken = nil
    }

    /// Mobile/client-side init with a SessionToken obtained from your backend.
    /// The ApiKey is never stored in the app.
    public init(
        sessionToken: String,
        entityCode: Int,
        environment: EcollectEnvironment = .test,
        srvCode: Int? = nil
    ) {
        self.sessionToken = sessionToken
        self.entityCode = entityCode
        self.environment = environment
        self.srvCode = srvCode
        self.apiKey = nil
    }

    var baseURL: String { environment.baseURL }
    var transactionInfoURL: String { environment.transactionInfoURL }
}
