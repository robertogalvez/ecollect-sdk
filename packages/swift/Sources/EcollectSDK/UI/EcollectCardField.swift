import Foundation

/// Placeholder UI component for secure card data capture.
///
/// In a real iOS project this would extend UIView (UIKit) or implement SwiftUI's View protocol.
/// The component renders an isolated input view where the cardholder enters their PAN, CVV,
/// and expiration date. The data goes directly from the component to ecollect's tokenization
/// endpoint — the PAN never reaches the merchant's app code or backend.
///
/// Usage (conceptual):
/// ```swift
/// let cardField = EcollectCardField()
/// cardField.sessionToken = sessionToken
/// cardField.entityCode = 123
/// cardField.onTokenReceived = { tokenId in
///     // Pass tokenId to your backend to complete the payment
/// }
/// try await cardField.submit()
/// ```
public final class EcollectCardField {

    // MARK: - Configuration

    /// Session token obtained from the merchant's backend. Required before calling `submit()`.
    public var sessionToken: String = ""

    /// Merchant entity code assigned by ecollect.
    public var entityCode: Int = 0

    // MARK: - Callbacks

    /// Called when ecollect returns a TokenId after successful card capture.
    public var onTokenReceived: ((String) -> Void)?

    /// Called when an error occurs during tokenization.
    public var onError: ((EcollectError) -> Void)?

    public init() {}

    // MARK: - Submit

    /// Submits the captured card data directly to ecollect for tokenization.
    /// Returns the TokenId on success.
    ///
    /// - Returns: The ecollect TokenId.
    /// - Throws: `EcollectError` on failure.
    ///
    /// Note: This is a stub. In a real implementation this method would:
    /// 1. Read card data from the secure isolated input fields.
    /// 2. Validate client-side (Luhn, expiry).
    /// 3. POST directly to ecollect's tokenCommand endpoint.
    /// 4. Return the TokenId (never the raw PAN).
    public func submit() async throws -> String {
        // Stub — replace with real implementation in a UIKit/SwiftUI context.
        guard !sessionToken.isEmpty else {
            throw EcollectError.invalidConfig("sessionToken must be set before calling submit()")
        }
        guard entityCode > 0 else {
            throw EcollectError.invalidConfig("entityCode must be set before calling submit()")
        }
        // Real implementation: capture card fields, validate, tokenize via EcollectSDK.
        return ""
    }
}
