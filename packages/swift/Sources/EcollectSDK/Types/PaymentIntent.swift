import Foundation

/// Represents a payment intention to be processed by ecollect.
public struct PaymentIntent {
    /// Total amount without taxes.
    public var amount: Decimal
    /// VAT/tax amount (optional).
    public var vatAmount: Decimal?
    /// ISO 4217 currency code (e.g. "COP", "USD", "MXN", "DOP").
    public var currency: String
    /// Optional ecollect service code override (falls back to client config).
    public var srvCode: Int?
    /// Redirect URL after hosted payment completion.
    public var urlRedirect: String?
    /// Webhook URL for transaction result notification.
    public var urlResponse: String?
    /// ISO 639-1 language code ("ES" or "EN"). Defaults to "ES".
    public var langCode: String
    /// ecollect payment system code (see PaymentSystem Values).
    public var paymentSystem: String?
    /// Financial institution code selected by the user.
    public var fiCode: String?
    /// Invoice reference for in-person payment channels.
    public var invoice: String?
    /// Invoice due date in yyyyMMddHHmmss format.
    public var invoiceDueDate: String?
    /// Policy code for debit/credit policy configuration.
    public var policyCode: String?
    /// Request type: 0=immediate, 1=pre-auth, TicketId=capture, -TicketId=void.
    public var requestType: Int
    /// Reference array: [0]=DocType, [1]=DocNumber, [2]=MerchantOrderId,
    /// [3]=FullName, [4]=Email, [5]=Phone, [6..n]=extra.
    public var referenceArray: [String]
    /// Additional payment attributes (IPAddress, DeviceFingerPrint, etc.).
    public var paymentInfoArray: [PaymentInfoType]?
    /// Token info for credit card token-based payments.
    public var tokenInfoArray: [PaymentInfoType]?
    /// Subservices for payment splitting/dispersal.
    public var subservicesArray: [SubserviceType]?
    /// Channel-specific info.
    public var channelInfoArray: [ChannelInfoType]?

    public init(
        amount: Decimal,
        currency: String,
        referenceArray: [String],
        vatAmount: Decimal? = nil,
        srvCode: Int? = nil,
        urlRedirect: String? = nil,
        urlResponse: String? = nil,
        langCode: String = "ES",
        paymentSystem: String? = nil,
        fiCode: String? = nil,
        invoice: String? = nil,
        invoiceDueDate: String? = nil,
        policyCode: String? = nil,
        requestType: Int = 0,
        paymentInfoArray: [PaymentInfoType]? = nil,
        tokenInfoArray: [PaymentInfoType]? = nil,
        subservicesArray: [SubserviceType]? = nil,
        channelInfoArray: [ChannelInfoType]? = nil
    ) {
        self.amount = amount
        self.currency = currency
        self.referenceArray = referenceArray
        self.vatAmount = vatAmount
        self.srvCode = srvCode
        self.urlRedirect = urlRedirect
        self.urlResponse = urlResponse
        self.langCode = langCode
        self.paymentSystem = paymentSystem
        self.fiCode = fiCode
        self.invoice = invoice
        self.invoiceDueDate = invoiceDueDate
        self.policyCode = policyCode
        self.requestType = requestType
        self.paymentInfoArray = paymentInfoArray
        self.tokenInfoArray = tokenInfoArray
        self.subservicesArray = subservicesArray
        self.channelInfoArray = channelInfoArray
    }
}
