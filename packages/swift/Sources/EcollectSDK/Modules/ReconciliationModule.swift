import Foundation

/// Handles transaction status queries and background reconciliation (Proceso Sonda).
public final class ReconciliationModule {
    private let config: EcollectConfig
    private let http: HttpClient
    private let session: SessionModule

    init(config: EcollectConfig, http: HttpClient, session: SessionModule) {
        self.config = config
        self.http = http
        self.session = session
    }

    // MARK: - getTransactionStatus

    /// Queries the current state of a transaction by TicketId.
    /// - Parameter ticketId: The ecollect TicketId.
    public func getTransactionStatus(ticketId: Int) async throws -> TransactionInfoResponse {
        let token = try await session.getSessionToken()
        let body = GetTransactionInfoRequest(
            EntityCode: config.entityCode,
            SessionToken: token,
            TicketId: ticketId,
            PaymentInfoArray: nil
        )
        return try await fetchTransactionInfo(body: body)
    }

    /// Queries the current state of a transaction by MerchantTransactionId (contingency).
    /// - Parameter merchantTransactionId: The merchant's own unique transaction reference.
    public func getTransactionStatusByMerchantId(
        _ merchantTransactionId: String
    ) async throws -> TransactionInfoResponse {
        let token = try await session.getSessionToken()
        let fallbackAttr = PaymentInfoType(
            code: AttributeCode.merchantTransactionId,
            desc: "MerchantTransactionId",
            value: merchantTransactionId
        )
        let body = GetTransactionInfoRequest(
            EntityCode: config.entityCode,
            SessionToken: token,
            TicketId: nil,
            PaymentInfoArray: [fallbackAttr]
        )
        return try await fetchTransactionInfo(body: body)
    }

    // MARK: - Reconciliate (polling)

    /// Polls ecollect until the transaction reaches a final state or the timeout expires.
    /// This implements the Proceso Sonda described in the API documentation.
    ///
    /// - Parameters:
    ///   - ticketId: The ecollect TicketId to monitor.
    ///   - timeout: Maximum wait time in seconds (default 600 = 10 minutes).
    /// - Returns: The final `TransactionInfoResponse`.
    /// - Throws: `EcollectError.pollingTimeout` if no final state is reached.
    public func reconciliate(
        ticketId: Int,
        timeout: TimeInterval = 600
    ) async throws -> TransactionInfoResponse {
        return try await PollingManager.poll(ticketId: ticketId, timeout: timeout) {
            try await self.getTransactionStatus(ticketId: ticketId)
        }
    }

    // MARK: - Private helpers

    private func fetchTransactionInfo(
        body: GetTransactionInfoRequest,
        attempt: Int = 0
    ) async throws -> TransactionInfoResponse {
        let response: TransactionInfoResponse = try await http.postAbsolute(
            url: config.transactionInfoURL,
            body: body
        )

        if response.ReturnCode == "FAIL_APIEXPIREDSESSION" && attempt == 0 {
            try await session.refreshToken()
            // Rebuild request with fresh token
            let token = try await session.getSessionToken()
            let refreshed = GetTransactionInfoRequest(
                EntityCode: config.entityCode,
                SessionToken: token,
                TicketId: body.TicketId,
                PaymentInfoArray: body.PaymentInfoArray
            )
            return try await fetchTransactionInfo(body: refreshed, attempt: 1)
        }

        guard response.ReturnCode == "SUCCESS" else {
            throw EcollectError.from(returnCode: response.ReturnCode)
        }
        return response
    }
}
