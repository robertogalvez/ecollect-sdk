import Foundation

/// Manages ecollect session tokens: creation, in-memory caching, and auto-refresh.
public final class SessionModule {
    private let config: EcollectConfig
    private let http: HttpClient

    // MARK: - In-memory cache

    private var cachedToken: String?
    private var tokenExpiresAt: Date?
    /// Refresh threshold: request a new token when fewer than this many seconds remain.
    private let refreshThresholdSecs: Int = 300 // 5 minutes

    init(config: EcollectConfig, http: HttpClient) {
        self.config = config
        self.http = http
        // Pre-populate cache if SDK was initialized with a session token.
        if let token = config.sessionToken {
            self.cachedToken = token
            // We don't know the exact expiry, assume 30 min from now.
            self.tokenExpiresAt = Date().addingTimeInterval(1800)
        }
    }

    // MARK: - Public API

    /// Returns a valid session token, fetching or refreshing as needed.
    public func getSessionToken() async throws -> String {
        if let token = cachedToken, let expiry = tokenExpiresAt {
            let remaining = expiry.timeIntervalSinceNow
            if remaining > Double(refreshThresholdSecs) {
                return token
            }
        }
        return try await refreshToken()
    }

    /// Forces a new token to be fetched from ecollect.
    @discardableResult
    public func refreshToken() async throws -> String {
        guard let apiKey = config.apiKey else {
            throw EcollectError.invalidConfig(
                "ApiKey is required to obtain a SessionToken. " +
                "Use EcollectClient.fromSessionToken(_:) for mobile initialization."
            )
        }

        let body = GetSessionTokenRequest(
            EntityCode: config.entityCode,
            ApiKey: apiKey
        )
        let response: GetSessionTokenResponse = try await http.post(
            endpoint: "getSessionToken",
            body: body
        )

        guard response.ReturnCode == "SUCCESS", let token = response.SessionToken else {
            throw EcollectError.from(returnCode: response.ReturnCode)
        }

        cachedToken = token
        let lifetime = response.LifetimeSecs ?? 1800
        tokenExpiresAt = Date().addingTimeInterval(TimeInterval(lifetime))
        return token
    }

    /// Clears the cached session token.
    public func clearCache() {
        cachedToken = nil
        tokenExpiresAt = nil
    }

    /// Exposes the remaining lifetime of the cached token in seconds, or nil if not cached.
    public var tokenRemainingSeconds: Int? {
        guard let expiry = tokenExpiresAt else { return nil }
        let remaining = expiry.timeIntervalSinceNow
        return remaining > 0 ? Int(remaining) : nil
    }
}
