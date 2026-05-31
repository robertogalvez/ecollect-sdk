import Foundation

/// Client-side validation helpers. These run before any network call to
/// catch obvious errors early and avoid unnecessary round-trips.
public enum Validators {

    // MARK: - Luhn Algorithm

    /// Returns true if the card number passes the Luhn check.
    public static func luhnCheck(_ number: String) -> Bool {
        let digits = number.compactMap { $0.wholeNumberValue }
        guard digits.count >= 13 && digits.count <= 19 else { return false }

        var sum = 0
        let reversed = digits.reversed()
        for (index, digit) in reversed.enumerated() {
            if index % 2 == 1 {
                let doubled = digit * 2
                sum += doubled > 9 ? doubled - 9 : doubled
            } else {
                sum += digit
            }
        }
        return sum % 10 == 0
    }

    // MARK: - PaymentIntent validation

    /// Validates the core fields of a PaymentIntent before sending to ecollect.
    /// Throws `EcollectError.validation` for any failure.
    public static func validatePaymentIntent(_ intent: PaymentIntent) throws {
        guard intent.amount > 0 else {
            throw EcollectError.validation("amount must be greater than 0")
        }
        let validCurrencies = ["COP", "MXN", "DOP", "USD", "EUR"]
        guard validCurrencies.contains(intent.currency.uppercased()) else {
            throw EcollectError.validation("currency '\(intent.currency)' is not supported")
        }
        guard !intent.referenceArray.isEmpty, !intent.referenceArray[0].isEmpty else {
            throw EcollectError.validation("referenceArray must contain at least one non-empty reference")
        }
        if let vat = intent.vatAmount {
            guard vat >= 0 else {
                throw EcollectError.validation("vatAmount cannot be negative")
            }
        }
    }

    // MARK: - Email validation

    /// Returns true if the string looks like a valid email address.
    public static func isValidEmail(_ email: String) -> Bool {
        let pattern = #"^[^\s@]+@[^\s@]+\.[^\s@]+$"#
        return email.range(of: pattern, options: .regularExpression) != nil
    }

    // MARK: - Country-specific validation

    /// Validates document type and payment system constraints for the given country.
    /// - Parameters:
    ///   - documentType: The DocumentType to check.
    ///   - paymentSystem: ecollect payment system code (as string).
    ///   - country: Two-letter ISO country code ("CO", "MX", "DO").
    public static func validateByCountry(
        documentType: DocumentType?,
        paymentSystem: String?,
        country: String
    ) throws {
        let co = ["CC", "NIT", "PP", "CE", "DE"]
        let doDR = ["CI", "RNC", "PP"]
        let mx = ["CURP", "IFE", "RFC", "PP"]

        switch country.uppercased() {
        case "CO":
            if let dt = documentType, !co.contains(dt.rawValue) {
                throw EcollectError.validation("DocumentType '\(dt.rawValue)' is not valid in Colombia")
            }
            if let ps = paymentSystem, !["0", "1"].contains(ps) {
                throw EcollectError.validation("PaymentSystem '\(ps)' is not available in Colombia")
            }
        case "DO":
            if let dt = documentType, !doDR.contains(dt.rawValue) {
                throw EcollectError.validation("DocumentType '\(dt.rawValue)' is not valid in Dominican Republic")
            }
            if let ps = paymentSystem, !["3", "6"].contains(ps) {
                throw EcollectError.validation("PaymentSystem '\(ps)' is not available in Dominican Republic")
            }
        case "MX":
            if let dt = documentType, !mx.contains(dt.rawValue) {
                throw EcollectError.validation("DocumentType '\(dt.rawValue)' is not valid in Mexico")
            }
            if let ps = paymentSystem, !["1", "7"].contains(ps) {
                throw EcollectError.validation("PaymentSystem '\(ps)' is not available in Mexico")
            }
        default:
            break // Unknown country — skip country-specific validation
        }
    }

    // MARK: - Card expiration date

    /// Returns true if the expiration string (MM/YYYY or MM/YY) is still valid.
    public static func isExpirationDateValid(_ expiration: String) -> Bool {
        let parts = expiration.split(separator: "/")
        guard parts.count == 2,
              let month = Int(parts[0]),
              var year = Int(parts[1]) else { return false }
        guard month >= 1 && month <= 12 else { return false }

        if year < 100 { year += 2000 }

        let calendar = Calendar.current
        let now = Date()
        let components = calendar.dateComponents([.month, .year], from: now)
        guard let currentYear = components.year, let currentMonth = components.month else { return false }

        if year > currentYear { return true }
        if year == currentYear && month >= currentMonth { return true }
        return false
    }
}
