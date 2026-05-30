import XCTest
@testable import EcollectSDK

final class ValidatorsTests: XCTestCase {

    // MARK: - Luhn

    func testLuhn_validVisa() {
        XCTAssertTrue(Validators.luhnCheck("4532015112830366"))
    }

    func testLuhn_validMastercard() {
        XCTAssertTrue(Validators.luhnCheck("5425233430109903"))
    }

    func testLuhn_validAmex() {
        XCTAssertTrue(Validators.luhnCheck("374251018720955"))
    }

    func testLuhn_invalidNumber() {
        XCTAssertFalse(Validators.luhnCheck("1234567890123456"))
    }

    func testLuhn_tooShort() {
        XCTAssertFalse(Validators.luhnCheck("123456"))
    }

    func testLuhn_tooLong() {
        XCTAssertFalse(Validators.luhnCheck("45320151128303660000"))
    }

    func testLuhn_nonDigits() {
        XCTAssertFalse(Validators.luhnCheck("4532-0151-1283-0366"))
    }

    // MARK: - Email validation

    func testEmail_valid() {
        XCTAssertTrue(Validators.isValidEmail("user@example.com"))
        XCTAssertTrue(Validators.isValidEmail("first.last+tag@sub.domain.co"))
    }

    func testEmail_invalid() {
        XCTAssertFalse(Validators.isValidEmail("notanemail"))
        XCTAssertFalse(Validators.isValidEmail("missing@"))
        XCTAssertFalse(Validators.isValidEmail("@nodomain.com"))
    }

    // MARK: - PaymentIntent validation

    func testValidateIntent_valid() throws {
        let intent = PaymentIntent(
            amount: 100,
            currency: "COP",
            referenceArray: ["CC", "12345"]
        )
        XCTAssertNoThrow(try Validators.validatePaymentIntent(intent))
    }

    func testValidateIntent_zeroAmount() {
        let intent = PaymentIntent(amount: 0, currency: "COP", referenceArray: ["ref"])
        XCTAssertThrowsError(try Validators.validatePaymentIntent(intent)) { error in
            if case EcollectError.validation(let msg) = error {
                XCTAssertTrue(msg.contains("amount"))
            } else {
                XCTFail("Expected validation error")
            }
        }
    }

    func testValidateIntent_negativeAmount() {
        let intent = PaymentIntent(amount: -5, currency: "USD", referenceArray: ["ref"])
        XCTAssertThrowsError(try Validators.validatePaymentIntent(intent))
    }

    func testValidateIntent_unsupportedCurrency() {
        let intent = PaymentIntent(amount: 100, currency: "XYZ", referenceArray: ["ref"])
        XCTAssertThrowsError(try Validators.validatePaymentIntent(intent)) { error in
            if case EcollectError.validation(let msg) = error {
                XCTAssertTrue(msg.contains("currency"))
            } else {
                XCTFail("Expected validation error")
            }
        }
    }

    func testValidateIntent_emptyReferenceArray() {
        let intent = PaymentIntent(amount: 50, currency: "MXN", referenceArray: [])
        XCTAssertThrowsError(try Validators.validatePaymentIntent(intent))
    }

    // MARK: - Country validation

    func testCountryValidation_colombia_validDocType() throws {
        XCTAssertNoThrow(
            try Validators.validateByCountry(documentType: .cc, paymentSystem: "1", country: "CO")
        )
    }

    func testCountryValidation_colombia_invalidDocType() {
        XCTAssertThrowsError(
            try Validators.validateByCountry(documentType: .cedula, paymentSystem: "1", country: "CO")
        )
    }

    func testCountryValidation_mexico_validDocType() throws {
        XCTAssertNoThrow(
            try Validators.validateByCountry(documentType: .ife, paymentSystem: "1", country: "MX")
        )
    }

    func testCountryValidation_dominicanRepublic_validDocType() throws {
        XCTAssertNoThrow(
            try Validators.validateByCountry(documentType: .cedula, paymentSystem: "3", country: "DO")
        )
    }

    func testCountryValidation_dominicanRepublic_invalidPaymentSystem() {
        XCTAssertThrowsError(
            try Validators.validateByCountry(documentType: .cedula, paymentSystem: "0", country: "DO")
        )
    }

    func testCountryValidation_unknownCountry_noThrow() throws {
        // Unknown countries are allowed through (no rules)
        XCTAssertNoThrow(
            try Validators.validateByCountry(documentType: nil, paymentSystem: nil, country: "PE")
        )
    }

    // MARK: - Expiration date

    func testExpirationDate_futureDate_valid() {
        // 12/2099 should always be valid
        XCTAssertTrue(Validators.isExpirationDateValid("12/2099"))
    }

    func testExpirationDate_pastDate_invalid() {
        XCTAssertFalse(Validators.isExpirationDateValid("01/2000"))
    }

    func testExpirationDate_malformedDate_invalid() {
        XCTAssertFalse(Validators.isExpirationDateValid("13/2025"))
        XCTAssertFalse(Validators.isExpirationDateValid("notadate"))
    }
}
