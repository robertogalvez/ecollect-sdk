import Foundation

// MARK: - Generic ecollect attribute structure

/// Generic key-value attribute used by PaymentInfoArray, TokenInfoArray, etc.
public struct PaymentInfoType: Codable {
    public let AttributeCode: Int
    public let AttributeDesc: String
    public let AttributeValue: String

    public init(code: Int, desc: String, value: String) {
        self.AttributeCode = code
        self.AttributeDesc = desc
        self.AttributeValue = value
    }
}

/// Generic channel info attribute.
public struct ChannelInfoType: Codable {
    public let AttributeCode: Int
    public let AttributeDesc: String
    public let AttributeValue: String
}

// MARK: - AttributeCode constants

public enum AttributeCode {
    public static let cardNumber = 0
    public static let tokenId = 1
    public static let paymentSystem = 2
    public static let secureCode = 3
    public static let expirationDate = 4
    public static let installments = 5
    public static let usermail = 6
    public static let mobileCountryCode = 7
    public static let mobileNumber = 8
    public static let fiCode = 9
    public static let fiName = 10
    public static let last4 = 11
    public static let maskedCard = 12
    public static let brandImageUrl = 13
    public static let merchantId = 14
    public static let terminalNumber = 15
    public static let authResponse = 16
    public static let cardHolderName = 17
    public static let cardHolderIdType = 18
    public static let cardHolderId = 19
    public static let cardIssueCountry = 20
    public static let cardIssueBank = 21
    public static let accountType = 22
    public static let ipAddress = 23
    public static let deviceFingerPrint = 24
    public static let oneTimePassword = 25
    public static let merchantTransactionId = 26
    public static let devValue = 28
    public static let failCode = 29
    public static let bin4 = 30
    public static let userType = 34
    public static let lifetimeSecs = 35
    public static let customerId = 36
}

// MARK: - getSessionToken

struct GetSessionTokenRequest: Encodable {
    let EntityCode: Int
    let ApiKey: String
}

struct GetSessionTokenResponse: Decodable {
    let ReturnCode: String
    let SessionToken: String?
    let LifetimeSecs: Int?
}

// MARK: - createTransactionPayment

struct CreateTransactionRequest: Encodable {
    let EntityCode: Int
    let SessionToken: String
    let SrvCode: Int?
    let TransValue: Decimal
    let TransVatValue: Decimal?
    let SrvCurrency: String
    let URLRedirect: String?
    let URLResponse: String?
    let LangCode: String?
    let PaymentSystem: String?
    let FICode: String?
    let Invoice: String?
    let InvoiceDueDate: String?
    let PolicyCode: String?
    let RequestType: Int?
    let ReferenceArray: [String]
    let PaymentInfoArray: [PaymentInfoType]?
    let TokenInfoArray: [PaymentInfoType]?
    let SubservicesArray: [SubserviceType]?
    let ChannelInfoArray: [ChannelInfoType]?
}

struct SubserviceType: Codable {
    let EntityCode: Int
    let SrvCode: String
    let ValueType: Int
    let TransValue: Decimal
    let TransVatValue: Decimal?
}

struct CreateTransactionResponse: Decodable {
    let ReturnCode: String
    let TicketId: Int?
    let eCollectUrl: String?
    let LifetimeSecs: Int?
    let TransactionResponse: TransactionInfoResponse?
}

// MARK: - getTransactionInformation

struct GetTransactionInfoRequest: Encodable {
    let EntityCode: Int
    let SessionToken: String
    let TicketId: Int?
    let PaymentInfoArray: [PaymentInfoType]?
}

public struct TransactionInfoResponse: Decodable {
    public let EntityCode: Int?
    public let TicketId: Int?
    public let TrazabilityCode: String?
    public let TranState: String?
    public let ReturnCode: String
    public let TransValue: Decimal?
    public let TransVatValue: Decimal?
    public let PayCurrency: String?
    public let CurrencyRate: Decimal?
    public let BankProcessDate: String?
    public let FICode: String?
    public let FiName: String?
    public let PaymentSystem: String?
    public let TransCycle: String?
    public let Invoice: String?
    public let ReferenceArray: [String]?
    public let SrvCode: Int?
    public let PaymentInfoArray: [PaymentInfoType]?
    public let ChannelInfoArray: [ChannelInfoType]?
    public let SessionToken: String?
}

// MARK: - verifySessionToken

struct VerifySessionTokenRequest: Encodable {
    let EntityCode: Int
    let SessionToken: String
    let SessionTokenToVerify: String
    let TicketIdToVerify: Int?
}

struct VerifySessionTokenResponse: Decodable {
    let ReturnCode: String
}

// MARK: - getPaymentSystem

struct GetPaymentSystemRequest: Encodable {
    let EntityCode: Int
    let SessionToken: String
}

public struct GetPaymentSystemResponse: Decodable {
    public let ReturnCode: String
    public let PaymentSystemArray: [PaymentSystemType]?
}

public struct PaymentSystemType: Decodable {
    public let PaymentSystem: String
    public let BrandImageUrl: String?
    public let FiImagesArray: [FiImageType]?
    public let FiArray: [FiType]?
}

public struct FiImageType: Decodable {
    public let FiCode: String
    public let FindKeys: String?
    public let BrandImageUrl: String?
}

public struct FiType: Decodable {
    public let FiCode: String
    public let FiName: String
}

// MARK: - tokenCommand

struct TokenCommandRequest: Encodable {
    let EntityCode: Int
    let SessionToken: String
    let Command: String
    let TokenInfoArray: [PaymentInfoType]
}

public struct TokenCommandResponse: Decodable {
    public let ReturnCode: String
    public let TokenInfoArray: [PaymentInfoType]?
}

// MARK: - queryToken

struct QueryTokenRequest: Encodable {
    let EntityCode: Int
    let SessionToken: String
    let TokenInfoArray: [PaymentInfoType]?
}

public struct QueryTokenResponse: Decodable {
    public let ReturnCode: String
    public let TokenArray: [TokenType]?
}

public struct TokenType: Decodable {
    public let TokenInfoArray: [PaymentInfoType]?
    public let TokenStatus: String?
    public let LifetimeSecs: Int?
}

// MARK: - getCustomerId

struct GetCustomerIdRequest: Encodable {
    let EntityCode: Int
    let SessionToken: String
    let CustomerInfoArray: [PaymentInfoType]
}

public struct GetCustomerIdResponse: Decodable {
    public let ReturnCode: String
    public let CustomerInfoArray: [PaymentInfoType]?
}
