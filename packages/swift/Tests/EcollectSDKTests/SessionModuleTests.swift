import XCTest
@testable import EcollectSDK

// MARK: - URLProtocol mock for HTTP stubbing

final class MockURLProtocol: URLProtocol {
    static var requestHandler: ((URLRequest) throws -> (HTTPURLResponse, Data))?

    override class func canInit(with request: URLRequest) -> Bool { true }
    override class func canonicalRequest(for request: URLRequest) -> URLRequest { request }

    override func startLoading() {
        guard let handler = MockURLProtocol.requestHandler else {
            client?.urlProtocol(self, didFailWithError: URLError(.unknown))
            return
        }
        do {
            let (response, data) = try handler(request)
            client?.urlProtocol(self, didReceive: response, cacheStoragePolicy: .notAllowed)
            client?.urlProtocol(self, didLoad: data)
            client?.urlProtocolDidFinishLoading(self)
        } catch {
            client?.urlProtocol(self, didFailWithError: error)
        }
    }

    override func stopLoading() {}
}

// MARK: - Helpers

func makeSession() -> URLSession {
    let config = URLSessionConfiguration.ephemeral
    config.protocolClasses = [MockURLProtocol.self]
    return URLSession(configuration: config)
}

func jsonData(_ dict: [String: Any]) -> Data {
    try! JSONSerialization.data(withJSONObject: dict)
}

func httpOK(url: URL) -> HTTPURLResponse {
    HTTPURLResponse(url: url, statusCode: 200, httpVersion: nil, headerFields: nil)!
}

// MARK: - SessionModuleTests

final class SessionModuleTests: XCTestCase {

    func makeConfig(apiKey: String = "test-key") -> EcollectConfig {
        EcollectConfig(apiKey: apiKey, entityCode: 999, environment: .test)
    }

    func makeHttp(_ session: URLSession, config: EcollectConfig) -> HttpClient {
        HttpClient(baseURL: config.baseURL, session: session)
    }

    // MARK: Session creation success

    func testGetSessionToken_success() async throws {
        let urlSession = makeSession()
        let config = makeConfig()
        let http = makeHttp(urlSession, config: config)
        let module = SessionModule(config: config, http: http)

        MockURLProtocol.requestHandler = { req in
            let body: [String: Any] = [
                "ReturnCode": "SUCCESS",
                "SessionToken": "abc-token-123",
                "LifetimeSecs": 1800
            ]
            return (httpOK(url: req.url!), jsonData(body))
        }

        let token = try await module.getSessionToken()
        XCTAssertEqual(token, "abc-token-123")
    }

    // MARK: Session caching

    func testGetSessionToken_usesCachedToken() async throws {
        let urlSession = makeSession()
        let config = makeConfig()
        let http = makeHttp(urlSession, config: config)
        let module = SessionModule(config: config, http: http)

        var callCount = 0
        MockURLProtocol.requestHandler = { req in
            callCount += 1
            let body: [String: Any] = [
                "ReturnCode": "SUCCESS",
                "SessionToken": "cached-token",
                "LifetimeSecs": 3600
            ]
            return (httpOK(url: req.url!), jsonData(body))
        }

        _ = try await module.getSessionToken()
        _ = try await module.getSessionToken() // Should use cache

        XCTAssertEqual(callCount, 1, "Token should be cached after first fetch")
    }

    // MARK: Error mapping

    func testGetSessionToken_accessDenied_throwsAuthError() async throws {
        let urlSession = makeSession()
        let config = makeConfig()
        let http = makeHttp(urlSession, config: config)
        let module = SessionModule(config: config, http: http)

        MockURLProtocol.requestHandler = { req in
            let body: [String: Any] = ["ReturnCode": "FAIL_ACCESSDENIED"]
            return (httpOK(url: req.url!), jsonData(body))
        }

        do {
            _ = try await module.refreshToken()
            XCTFail("Expected authenticationFailed error")
        } catch EcollectError.authenticationFailed {
            // Expected
        }
    }

    // MARK: fromSessionToken initialization

    func testFromSessionToken_prePopulatesCache() async throws {
        let client = EcollectClient.fromSessionToken(
            "pre-loaded-token",
            etyCode: 100,
            environment: .test
        )
        // Remaining seconds should be set (no API call needed)
        XCTAssertNotNil(client.session.tokenRemainingSeconds)
    }
}
