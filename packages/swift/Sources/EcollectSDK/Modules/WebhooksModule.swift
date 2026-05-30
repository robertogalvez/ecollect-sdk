import Foundation

/// Handles webhook verification for ecollect transaction notifications.
public final class WebhooksModule {
    private let config: EcollectConfig
    private let http: HttpClient
    private let session: SessionModule

    init(config: EcollectConfig, http: HttpClient, session: SessionModule) {
        self.config = config
        self.http = http
        self.session = session
    }

    // MARK: - HMAC signature verification

    /// Verifies the webhook payload's HMAC-SHA256 signature.
    /// Use this when your backend has a shared secret with ecollect.
    /// - Parameters:
    ///   - payload: The raw JSON body string received from ecollect.
    ///   - signature: The signature header value from the webhook request.
    ///   - secret: Your shared HMAC secret.
    /// - Throws: `EcollectError.webhookValidationFailed` if the signature does not match.
    public func verifyWebhookSignature(
        payload: String,
        signature: String,
        secret: String
    ) throws {
        guard Crypto.verifyHMAC(key: secret, data: payload, signature: signature) else {
            throw EcollectError.webhookValidationFailed(
                "HMAC-SHA256 signature mismatch — webhook may be forged."
            )
        }
    }

    // MARK: - API-based session token verification

    /// Confirms a webhook notification by calling ecollect's verifySessionToken API.
    /// Verifies that the SessionToken and TicketId in the webhook payload are legitimate.
    /// - Parameters:
    ///   - sessionTokenToVerify: The SessionToken field from the webhook payload.
    ///   - ticketIdToVerify: The TicketId field from the webhook payload.
    /// - Throws: `EcollectError.webhookValidationFailed` if verification fails.
    public func confirmWebhook(
        sessionTokenToVerify: String,
        ticketIdToVerify: Int
    ) async throws {
        let currentToken = try await session.getSessionToken()
        let body = VerifySessionTokenRequest(
            EntityCode: config.entityCode,
            SessionToken: currentToken,
            SessionTokenToVerify: sessionTokenToVerify,
            TicketIdToVerify: ticketIdToVerify
        )
        let response: VerifySessionTokenResponse = try await http.post(
            endpoint: "verifySessionToken",
            body: body
        )
        guard response.ReturnCode == "SUCCESS" else {
            throw EcollectError.from(returnCode: response.ReturnCode,
                                     context: "Webhook verification for TicketId \(ticketIdToVerify)")
        }
    }
}
