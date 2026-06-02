import XCTest
@testable import EcollectSDK

final class PaymentSystemsModuleTests: XCTestCase {

    func makeConfig(apiKey: String = "test-key") -> EcollectConfig {
        EcollectConfig(apiKey: apiKey, entityCode: 999, environment: .test)
    }

    func makeModule(_ urlSession: URLSession, config: EcollectConfig) -> (PaymentSystemsModule, SessionModule) {
        let http = HttpClient(baseURL: config.baseURL, session: urlSession)
        let sessionModule = SessionModule(config: config, http: http)
        let module = PaymentSystemsModule(config: config, http: http, session: sessionModule)
        return (module, sessionModule)
    }

    // MARK: - Returns payment systems on SUCCESS

    func testGetPaymentSystems_success_returnsArray() async throws {
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
                "PaymentSystemArray": [
                    [
                        "PaymentSystem": "1",
                        "BrandImageUrl": "https://example.com/visa.svg",
                        "FiArray": [
                            ["FiCode": "VISA", "FiName": "Visa"]
                        ]
                    ],
                    [
                        "PaymentSystem": "2",
                        "BrandImageUrl": "https://example.com/mc.svg",
                        "FiArray": [
                            ["FiCode": "MC", "FiName": "Mastercard"]
                        ]
                    ]
                ]
            ]
            return (httpOK(url: req.url!), jsonData(body))
        }

        let systems = try await module.getPaymentSystems()
        XCTAssertEqual(systems.count, 2)
        XCTAssertEqual(systems[0].PaymentSystem, "1")
        XCTAssertEqual(systems[1].PaymentSystem, "2")
    }

    // MARK: - NO_RECORDS returns empty array

    func testGetPaymentSystems_noRecords_returnsEmpty() async throws {
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
            let body: [String: Any] = ["ReturnCode": "NO_RECORDS"]
            return (httpOK(url: req.url!), jsonData(body))
        }

        let systems = try await module.getPaymentSystems()
        XCTAssertTrue(systems.isEmpty)
    }

    // MARK: - API failure throws error

    func testGetPaymentSystems_apiFailure_throwsError() async throws {
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
            _ = try await module.getPaymentSystems()
            XCTFail("Expected error")
        } catch EcollectError.authenticationFailed {
            // Expected
        }
    }

    // MARK: - SUCCESS with missing PaymentSystemArray returns empty

    func testGetPaymentSystems_missingArray_returnsEmpty() async throws {
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
            // SUCCESS but PaymentSystemArray absent
            let body: [String: Any] = ["ReturnCode": "SUCCESS"]
            return (httpOK(url: req.url!), jsonData(body))
        }

        let systems = try await module.getPaymentSystems()
        XCTAssertTrue(systems.isEmpty)
    }

    // MARK: - FiArray is parsed correctly

    func testGetPaymentSystems_fiArrayParsed() async throws {
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
                "PaymentSystemArray": [
                    [
                        "PaymentSystem": "1",
                        "FiArray": [
                            ["FiCode": "VISA", "FiName": "Visa"],
                            ["FiCode": "MC", "FiName": "Mastercard"]
                        ]
                    ]
                ]
            ]
            return (httpOK(url: req.url!), jsonData(body))
        }

        let systems = try await module.getPaymentSystems()
        XCTAssertEqual(systems.count, 1)
        XCTAssertEqual(systems[0].FiArray?.count, 2)
        XCTAssertEqual(systems[0].FiArray?[0].FiCode, "VISA")
        XCTAssertEqual(systems[0].FiArray?[1].FiCode, "MC")
    }
}
