import XCTest
@testable import EcollectSDK

final class PaymentLinksModuleTests: XCTestCase {

    func makeConfig(apiKey: String = "test-key") -> EcollectConfig {
        EcollectConfig(apiKey: apiKey, entityCode: 999, environment: .test)
    }

    func makeModule(_ urlSession: URLSession, config: EcollectConfig) -> (PaymentLinksModule, SessionModule) {
        let http = HttpClient(baseURL: config.baseURL, session: urlSession)
        let sessionModule = SessionModule(config: config, http: http)
        let module = PaymentLinksModule(config: config, http: http, session: sessionModule)
        return (module, sessionModule)
    }

    func makeIntent() -> PaymentIntent {
        PaymentIntent(
            amount: Decimal(50000),
            currency: "COP",
            referenceArray: ["CC", "12345678", "ORDER-001", "John Doe", "john@example.com"]
        )
    }

    // MARK: - Generate email link success

    func testGeneratePaymentLink_email_success() async throws {
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
                "TicketId": 98765,
                "eCollectUrl": "https://checkout.test.ecollect.co/pay/98765",
                "LifetimeSecs": 3600
            ]
            return (httpOK(url: req.url!), jsonData(body))
        }

        let result = try await module.generatePaymentLink(
            intent: makeIntent(),
            method: .email(address: "customer@example.com")
        )

        XCTAssertEqual(result.ticketId, 98765)
        XCTAssertEqual(result.eCollectUrl, "https://checkout.test.ecollect.co/pay/98765")
        XCTAssertEqual(result.lifetimeSecs, 3600)
    }

    // MARK: - Generate SMS link success

    func testGeneratePaymentLink_sms_success() async throws {
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
                "TicketId": 11111,
                "eCollectUrl": "https://checkout.test.ecollect.co/pay/11111",
                "LifetimeSecs": 1800
            ]
            return (httpOK(url: req.url!), jsonData(body))
        }

        let result = try await module.generatePaymentLink(
            intent: makeIntent(),
            method: .sms(countryCode: "57", number: "3001234567")
        )

        XCTAssertEqual(result.ticketId, 11111)
        XCTAssertEqual(result.lifetimeSecs, 1800)
    }

    // MARK: - Generate QR link success

    func testGeneratePaymentLink_qr_success() async throws {
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
                "TicketId": 22222,
                "eCollectUrl": "https://checkout.test.ecollect.co/pay/22222",
                "LifetimeSecs": 7200
            ]
            return (httpOK(url: req.url!), jsonData(body))
        }

        let result = try await module.generatePaymentLink(
            intent: makeIntent(),
            method: .qr(lifetimeSecs: 7200)
        )

        XCTAssertEqual(result.ticketId, 22222)
        XCTAssertEqual(result.lifetimeSecs, 7200)
    }

    // MARK: - expiresAt is in the future

    func testPaymentLinkResult_expiresAt_isFuture() async throws {
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
                "TicketId": 33333,
                "eCollectUrl": "https://checkout.test.ecollect.co/pay/33333",
                "LifetimeSecs": 3600
            ]
            return (httpOK(url: req.url!), jsonData(body))
        }

        let result = try await module.generatePaymentLink(
            intent: makeIntent(),
            method: .email(address: "test@example.com")
        )
        XCTAssertGreaterThan(result.expiresAt, Date())
    }

    // MARK: - API failure throws error

    func testGeneratePaymentLink_apiFailure_throwsError() async throws {
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
            _ = try await module.generatePaymentLink(
                intent: makeIntent(),
                method: .email(address: "test@example.com")
            )
            XCTFail("Expected error")
        } catch {
            XCTAssertNotNil(error)
        }
    }

    // MARK: - Default lifetimeSecs fallback when absent from response

    func testGeneratePaymentLink_defaultLifetime_whenMissingInResponse() async throws {
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
            // No LifetimeSecs key in response
            let body: [String: Any] = [
                "ReturnCode": "SUCCESS",
                "TicketId": 44444,
                "eCollectUrl": "https://checkout.test.ecollect.co/pay/44444"
            ]
            return (httpOK(url: req.url!), jsonData(body))
        }

        let result = try await module.generatePaymentLink(
            intent: makeIntent(),
            method: .email(address: "test@example.com")
        )
        XCTAssertEqual(result.lifetimeSecs, 3600) // Default fallback in module
    }
}
