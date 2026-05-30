import Foundation

/// Retrieves the payment methods (medios de pago) enabled for this merchant.
public final class PaymentSystemsModule {
    private let config: EcollectConfig
    private let http: HttpClient
    private let session: SessionModule

    init(config: EcollectConfig, http: HttpClient, session: SessionModule) {
        self.config = config
        self.http = http
        self.session = session
    }

    /// Returns all payment systems enabled for this merchant.
    /// - Returns: Array of `PaymentSystemType` describing available payment methods.
    public func getPaymentSystems() async throws -> [PaymentSystemType] {
        let token = try await session.getSessionToken()
        let body = GetPaymentSystemRequest(
            EntityCode: config.entityCode,
            SessionToken: token
        )
        let response: GetPaymentSystemResponse = try await http.post(
            endpoint: "getPaymentSystem",
            body: body
        )
        switch response.ReturnCode {
        case "SUCCESS":
            return response.PaymentSystemArray ?? []
        case "NO_RECORDS":
            return []
        default:
            throw EcollectError.from(returnCode: response.ReturnCode)
        }
    }
}
