import XCTest
@testable import EcollectSDK

final class ReconciliationModuleTests: XCTestCase {

    func makeConfig(apiKey: String = "test-key") -> EcollectConfig {
        EcollectConfig(apiKey: apiKey, entityCode: 999, environment: .test)
    }

    func makeModule(_ urlSession: URLSession, config: EcollectConfig) -> (ReconciliationModule, SessionModule) {
        let http = HttpClient(baseURL: config.baseURL, session: urlSession)
        let sessionModule = SessionModule(config: config, http: http)
        let module = ReconciliationModule(config: config, http: http, session: sessionModule)
        return (module, sessionModule)
    }

    // MARK: - getTransactionStatus success

    func testGetTransactionStatus_success() async throws {
        let urlSession = makeSession()
        let config = makeConfig()
        let (module, _) = makeModule(urlSession, config: config)

        var callCount = 0
        MockURLProtocol.requestHandler = { req in
            callCount += 1
            if callCount == 1 {
                let body: [String: Any] = [
                    "ReturnCode": "SUCCESS",
                    "SessionToken": "tok-session",
                    "LifetimeSecs": 3600
                ]
                return (httpOK(url: req.url!), jsonData(body))
            }
            let body: [String: Any] = [
                "ReturnCode": "SUCCESS",
                "TicketId": 12345,
                "TranState": "APPROVED",
                "TrazabilityCode": "TRZ-001"
            ]
            return (httpOK(url: req.url!), jsonData(body))
        }

        let info = try await module.getTransactionStatus(ticketId: 12345)
        XCTAssertEqual(info.ReturnCode, "SUCCESS")
        XCTAssertEqual(info.TicketId, 12345)
        XCTAssertEqual(info.TranState, "APPROVED")
        XCTAssertEqual(info.TrazabilityCode, "TRZ-001")
    }

    // MARK: - getTransactionStatusByMerchantId success

    func testGetTransactionStatusByMerchantId_success() async throws {
        let urlSession = makeSession()
        let config = makeConfig()
        let (module, _) = makeModule(urlSession, config: config)

        var callCount = 0
        MockURLProtocol.requestHandler = { req in
            callCount += 1
            if callCount == 1 {
                let body: [String: Any] = [
                    "ReturnCode": "SUCCESS",
                    "SessionToken": "tok-session",
                    "LifetimeSecs": 3600
                ]
                return (httpOK(url: req.url!), jsonData(body))
            }
            let body: [String: Any] = [
                "ReturnCode": "SUCCESS",
                "TicketId": 99999,
                "TranState": "APPROVED"
            ]
            return (httpOK(url: req.url!), jsonData(body))
        }

        let info = try await module.getTransactionStatusByMerchantId("MERCH-TXN-001")
        XCTAssertEqual(info.ReturnCode, "SUCCESS")
        XCTAssertEqual(info.TicketId, 99999)
    }

    // MARK: - getTransactionStatus failure throws error

    func testGetTransactionStatus_failure_throwsError() async throws {
        let urlSession = makeSession()
        let config = makeConfig()
        let (module, _) = makeModule(urlSession, config: config)

        var callCount = 0
        MockURLProtocol.requestHandler = { req in
            callCount += 1
            if callCount == 1 {
                let body: [String: Any] = [
                    "ReturnCode": "SUCCESS",
                    "SessionToken": "tok-session",
                    "LifetimeSecs": 3600
                ]
                return (httpOK(url: req.url!), jsonData(body))
            }
            let body: [String: Any] = ["ReturnCode": "FAIL_ACCESSDENIED"]
            return (httpOK(url: req.url!), jsonData(body))
        }

        do {
            _ = try await module.getTransactionStatus(ticketId: 12345)
            XCTFail("Expected error")
        } catch EcollectError.authenticationFailed {
            // Expected
        }
    }

    // MARK: - Expired session auto-refreshes and retries once

    func testGetTransactionStatus_expiredSession_refreshesAndRetries() async throws {
        let urlSession = makeSession()
        let config = makeConfig()
        let (module, _) = makeModule(urlSession, config: config)

        var callCount = 0
        MockURLProtocol.requestHandler = { req in
            callCount += 1
            if callCount <= 2 {
                // First two calls are for session token (initial + refresh)
                let body: [String: Any] = [
                    "ReturnCode": "SUCCESS",
                    "SessionToken": "tok-refreshed",
                    "LifetimeSecs": 3600
                ]
                return (httpOK(url: req.url!), jsonData(body))
            }
            if callCount == 3 {
                // First transaction info call returns expired session
                let body: [String: Any] = ["ReturnCode": "FAIL_APIEXPIREDSESSION"]
                return (httpOK(url: req.url!), jsonData(body))
            }
            // Retry succeeds
            let body: [String: Any] = [
                "ReturnCode": "SUCCESS",
                "TicketId": 12345,
                "TranState": "APPROVED"
            ]
            return (httpOK(url: req.url!), jsonData(body))
        }

        let info = try await module.getTransactionStatus(ticketId: 12345)
        XCTAssertEqual(info.ReturnCode, "SUCCESS")
    }

    // MARK: - reconciliate polls until final state

    func testReconciliate_pollsUntilFinalState() async throws {
        let urlSession = makeSession()
        let config = makeConfig()
        let (module, _) = makeModule(urlSession, config: config)

        var txCallCount = 0
        MockURLProtocol.requestHandler = { req in
            if req.url?.absoluteString.contains("getSessionToken") == true
                || req.url?.absoluteString.contains("session") == true
                    && req.url?.absoluteString.contains("getSession") == true {
                let body: [String: Any] = [
                    "ReturnCode": "SUCCESS",
                    "SessionToken": "tok-session",
                    "LifetimeSecs": 3600
                ]
                return (httpOK(url: req.url!), jsonData(body))
            }

            // Check if this is the session token endpoint vs transaction info
            // Session endpoint contains /api/ path, transaction info uses absolute URL
            // We distinguish by checking request body or path heuristics
            // For simplicity, first call is session token, subsequent are transaction status
            txCallCount += 1
            if txCallCount <= 2 {
                let body: [String: Any] = [
                    "ReturnCode": "SUCCESS",
                    "TicketId": 12345,
                    "TranState": "PENDING"
                ]
                return (httpOK(url: req.url!), jsonData(body))
            }
            let body: [String: Any] = [
                "ReturnCode": "SUCCESS",
                "TicketId": 12345,
                "TranState": "APPROVED"
            ]
            return (httpOK(url: req.url!), jsonData(body))
        }

        let info = try await module.reconciliate(ticketId: 12345, timeout: 30)
        XCTAssertEqual(info.TranState, "APPROVED")
    }
}
