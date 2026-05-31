import XCTest
@testable import EcollectSDK

final class ErrorMappingTests: XCTestCase {

    // MARK: - ReturnCode → EcollectError mapping

    func testMapping_expiredSession() {
        let error = EcollectError.from(returnCode: "FAIL_APIEXPIREDSESSION")
        if case .sessionExpired = error { } else {
            XCTFail("Expected sessionExpired, got: \(error)")
        }
    }

    func testMapping_invalidEntityCode() {
        let error = EcollectError.from(returnCode: "FAIL_INVALIDENTITYCODE")
        if case .invalidConfig = error { } else {
            XCTFail("Expected invalidConfig, got: \(error)")
        }
    }

    func testMapping_invalidServiceCode() {
        let error = EcollectError.from(returnCode: "FAIL_INVALIDSERVICECODE")
        if case .invalidConfig = error { } else {
            XCTFail("Expected invalidConfig, got: \(error)")
        }
    }

    func testMapping_invalidCreditCard() {
        let error = EcollectError.from(returnCode: "FAIL_INVALIDCREDITCARD")
        if case .invalidCard = error { } else {
            XCTFail("Expected invalidCard, got: \(error)")
        }
    }

    func testMapping_invalidExpirationDate() {
        let error = EcollectError.from(returnCode: "FAIL_INVALIDEXPIRATIONDATE")
        if case .invalidCard = error { } else {
            XCTFail("Expected invalidCard, got: \(error)")
        }
    }

    func testMapping_tokenNotFound() {
        let error = EcollectError.from(returnCode: "FAIL_TOKENNOTFOUND")
        if case .tokenNotFound = error { } else {
            XCTFail("Expected tokenNotFound, got: \(error)")
        }
    }

    func testMapping_tokenExpired() {
        let error = EcollectError.from(returnCode: "FAIL_TOKENEXPIRED")
        if case .tokenNotFound = error { } else {
            XCTFail("Expected tokenNotFound, got: \(error)")
        }
    }

    func testMapping_duplicateTransaction() {
        let error = EcollectError.from(returnCode: "FAIL_MERCHANTRANSID")
        if case .duplicateTransaction = error { } else {
            XCTFail("Expected duplicateTransaction, got: \(error)")
        }
    }

    func testMapping_accessDenied() {
        let error = EcollectError.from(returnCode: "FAIL_ACCESSDENIED")
        if case .authenticationFailed = error { } else {
            XCTFail("Expected authenticationFailed, got: \(error)")
        }
    }

    func testMapping_sessionNotFound() {
        let error = EcollectError.from(returnCode: "FAIL_SESSIONNOTFOUND")
        if case .webhookValidationFailed = error { } else {
            XCTFail("Expected webhookValidationFailed, got: \(error)")
        }
    }

    func testMapping_ticketIdNotMatch() {
        let error = EcollectError.from(returnCode: "FAIL_TICKETIDNOTMATCH")
        if case .webhookValidationFailed = error { } else {
            XCTFail("Expected webhookValidationFailed, got: \(error)")
        }
    }

    func testMapping_systemError() {
        let error = EcollectError.from(returnCode: "FAIL_SYSTEM")
        if case .networkRetryable = error { } else {
            XCTFail("Expected networkRetryable, got: \(error)")
        }
    }

    func testMapping_unknownCode_genericApiError() {
        let error = EcollectError.from(returnCode: "FAIL_SOMETHING_NEW")
        if case .apiError(let code, _) = error {
            XCTAssertEqual(code, "FAIL_SOMETHING_NEW")
        } else {
            XCTFail("Expected apiError, got: \(error)")
        }
    }

    // MARK: - LocalizedError descriptions

    func testErrorDescriptions_notEmpty() {
        let errors: [EcollectError] = [
            .sessionExpired("test"),
            .invalidConfig("test"),
            .validation("test"),
            .invalidCard("test"),
            .networkRetryable("test"),
            .tokenNotFound("test"),
            .duplicateTransaction("test"),
            .authenticationFailed("test"),
            .webhookValidationFailed("test"),
            .pollingTimeout("test"),
            .apiError(code: "CODE", message: "msg"),
        ]
        for error in errors {
            XCTAssertNotNil(error.errorDescription, "errorDescription should not be nil for \(error)")
            XCTAssertFalse(error.errorDescription!.isEmpty, "errorDescription should not be empty for \(error)")
        }
    }

    // MARK: - HMAC webhook signature

    func testHMAC_correctSignature_noThrow() throws {
        let module = WebhooksModule(
            config: EcollectConfig(apiKey: "key", entityCode: 1),
            http: HttpClient(baseURL: "https://test1.e-collect.com/app_express/api/"),
            session: SessionModule(
                config: EcollectConfig(apiKey: "key", entityCode: 1),
                http: HttpClient(baseURL: "https://test1.e-collect.com/app_express/api/")
            )
        )
        let payload = "{\"TicketId\":123}"
        let secret = "my-secret"
        let sig = Crypto.hmacSHA256(key: secret, data: payload)
        XCTAssertNoThrow(try module.verifyWebhookSignature(payload: payload, signature: sig, secret: secret))
    }

    func testHMAC_wrongSignature_throws() throws {
        let module = WebhooksModule(
            config: EcollectConfig(apiKey: "key", entityCode: 1),
            http: HttpClient(baseURL: "https://test1.e-collect.com/app_express/api/"),
            session: SessionModule(
                config: EcollectConfig(apiKey: "key", entityCode: 1),
                http: HttpClient(baseURL: "https://test1.e-collect.com/app_express/api/")
            )
        )
        XCTAssertThrowsError(
            try module.verifyWebhookSignature(payload: "{}", signature: "bad-sig", secret: "my-secret")
        ) { error in
            if case EcollectError.webhookValidationFailed = error { } else {
                XCTFail("Expected webhookValidationFailed")
            }
        }
    }
}
