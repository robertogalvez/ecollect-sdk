import Foundation

/// Terminal transaction states — polling stops when one of these is received.
public let finalTranStates: Set<String> = ["OK", "NOT_AUTHORIZED", "EXPIRED", "FAILED"]

/// Intermediate states for which the SDK will NOT automatically retry a payment
/// (double payment prevention). Only poll for status updates in these states.
public let doublePaymentProtectedStates: Set<String> = ["BANK", "PENDING", "CAPTURED", "CREATED"]

/// Manages polling for transaction resolution using Swift Concurrency.
public final class PollingManager {

    /// Polls getTransactionInformation until a final state is reached or timeout expires.
    ///
    /// - Parameters:
    ///   - ticketId: The ecollect TicketId to poll.
    ///   - timeout: Maximum duration in seconds (default 600 = 10 minutes).
    ///   - fetch: Async closure that fetches the current `TransactionInfoResponse`.
    /// - Returns: The `TransactionInfoResponse` with a final `TranState`.
    /// - Throws: `EcollectError.pollingTimeout` if no final state is reached in time.
    public static func poll(
        ticketId: Int,
        timeout: TimeInterval = 600,
        fetch: @escaping () async throws -> TransactionInfoResponse
    ) async throws -> TransactionInfoResponse {
        let deadline = Date().addingTimeInterval(timeout)

        while true {
            let status = try await fetch()
            let state = status.TranState ?? ""

            if finalTranStates.contains(state) {
                return status
            }

            if Date() >= deadline {
                throw EcollectError.pollingTimeout(
                    "Polling timed out after \(Int(timeout))s for TicketId \(ticketId). Last state: \(state)"
                )
            }

            // BANK / PENDING: poll every 30 seconds
            // CREATED: user may have abandoned, poll every 5 minutes
            let interval: UInt64
            if state == "CREATED" {
                interval = 300_000_000_000 // 5 minutes
            } else {
                interval = 30_000_000_000  // 30 seconds
            }
            try await Task.sleep(nanoseconds: interval)
        }
    }
}
