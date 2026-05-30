import XCTest
@testable import EcollectSDK

final class TokensModuleTests: XCTestCase {

    // MARK: - Token command string values

    func testTokenCommandRawValues() {
        XCTAssertEqual(TokenCommand.get.rawValue, "GET")
        XCTAssertEqual(TokenCommand.save.rawValue, "SAVE")
        XCTAssertEqual(TokenCommand.remove.rawValue, "REMOVE")
        XCTAssertEqual(TokenCommand.update.rawValue, "UPDATE")
        XCTAssertEqual(TokenCommand.hold.rawValue, "HOLD")
    }

    // MARK: - SavedCard parsing

    func testSavedCard_parsesFromPaymentInfoArray() {
        let attrs: [PaymentInfoType] = [
            PaymentInfoType(code: AttributeCode.tokenId,       desc: "TokenId",       value: "tok-abc-123"),
            PaymentInfoType(code: AttributeCode.paymentSystem, desc: "PaymentSystem", value: "1"),
            PaymentInfoType(code: AttributeCode.fiCode,        desc: "FiCode",        value: "VISA"),
            PaymentInfoType(code: AttributeCode.fiName,        desc: "FiName",        value: "Visa"),
            PaymentInfoType(code: AttributeCode.last4,         desc: "Last4",         value: "1234"),
            PaymentInfoType(code: AttributeCode.maskedCard,    desc: "MaskedCard",    value: "VISA ****1234"),
            PaymentInfoType(code: AttributeCode.brandImageUrl, desc: "BrandImageUrl", value: "https://example.com/visa.svg"),
        ]

        let card = SavedCard(tokenInfoArray: attrs, status: "ACTIVE", lifetimeSecs: 3600)
        XCTAssertNotNil(card)
        XCTAssertEqual(card?.tokenId, "tok-abc-123")
        XCTAssertEqual(card?.paymentSystem, "1")
        XCTAssertEqual(card?.last4, "1234")
        XCTAssertEqual(card?.maskedCard, "VISA ****1234")
        XCTAssertEqual(card?.tokenStatus, .active)
    }

    func testSavedCard_missingRequiredFields_returnsNil() {
        let incomplete: [PaymentInfoType] = [
            PaymentInfoType(code: AttributeCode.tokenId, desc: "TokenId", value: "tok-123"),
            // Missing PaymentSystem and FiCode
        ]
        let card = SavedCard(tokenInfoArray: incomplete, status: "ACTIVE", lifetimeSecs: nil)
        XCTAssertNil(card)
    }

    func testSavedCard_expiredStatus() {
        let attrs: [PaymentInfoType] = [
            PaymentInfoType(code: AttributeCode.tokenId,       desc: "TokenId",       value: "tok-expired"),
            PaymentInfoType(code: AttributeCode.paymentSystem, desc: "PaymentSystem", value: "1"),
            PaymentInfoType(code: AttributeCode.fiCode,        desc: "FiCode",        value: "MC"),
        ]
        let card = SavedCard(tokenInfoArray: attrs, status: "EXPIRED", lifetimeSecs: nil)
        XCTAssertEqual(card?.tokenStatus, .expired)
    }
}
