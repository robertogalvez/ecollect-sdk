import Foundation

/// Supported document/ID types by country.
public enum DocumentType: String {
    // Colombia
    case cc = "CC"
    case nit = "NIT"
    case passport = "PP"
    case foreignCard = "CE"
    case foreignDoc = "DE"
    // República Dominicana
    case cedula = "CI"
    case rnc = "RNC"
    // México
    case curp = "CURP"
    case ife = "IFE"
    case rfc = "RFC"
}

/// Customer information used for payment and tokenization.
public struct Customer {
    public var firstName: String
    public var lastName: String
    public var email: String
    public var phone: String
    public var documentType: DocumentType
    public var documentNumber: String
    /// Mobile country code (e.g. 57=Colombia, 52=Mexico, 1=Dominican Republic).
    public var mobileCountryCode: String?

    public init(
        firstName: String,
        lastName: String,
        email: String,
        phone: String,
        documentType: DocumentType,
        documentNumber: String,
        mobileCountryCode: String? = nil
    ) {
        self.firstName = firstName
        self.lastName = lastName
        self.email = email
        self.phone = phone
        self.documentType = documentType
        self.documentNumber = documentNumber
        self.mobileCountryCode = mobileCountryCode
    }

    public var fullName: String { "\(firstName) \(lastName)" }
}
