import Foundation

/// A saved card returned by ecollect — PAN is never stored, only masked.
public struct SavedCard {
    public let tokenId: String
    public let maskedCard: String
    public let last4: String
    public let fiCode: String
    public let fiName: String?
    public let paymentSystem: String
    public let brandImageUrl: String?
    public let tokenStatus: TokenStatus
    public let lifetimeSecs: Int?
    public let oneTimePasswordRequired: Bool

    public enum TokenStatus: String {
        case active = "ACTIVE"
        case verify = "VERIFY"
        case expired = "EXPIRED"
        case unknown
    }

    /// Build a SavedCard from the raw PaymentInfoType array returned by queryToken.
    public init?(tokenInfoArray: [PaymentInfoType], status: String?, lifetimeSecs: Int?) {
        func value(for code: Int) -> String? {
            tokenInfoArray.first(where: { $0.AttributeCode == code })?.AttributeValue
        }

        guard let tokenId = value(for: AttributeCode.tokenId),
              let paymentSystem = value(for: AttributeCode.paymentSystem),
              let fiCode = value(for: AttributeCode.fiCode) else {
            return nil
        }

        self.tokenId = tokenId
        self.paymentSystem = paymentSystem
        self.fiCode = fiCode
        self.fiName = value(for: AttributeCode.fiName)
        self.last4 = value(for: AttributeCode.last4) ?? ""
        self.maskedCard = value(for: AttributeCode.maskedCard) ?? "****\(self.last4)"
        self.brandImageUrl = value(for: AttributeCode.brandImageUrl)
        self.lifetimeSecs = lifetimeSecs
        self.oneTimePasswordRequired = value(for: AttributeCode.oneTimePassword) != nil
        self.tokenStatus = TokenStatus(rawValue: status ?? "") ?? .unknown
    }
}
