import Foundation

/// All errors that can be thrown by the EcollectSDK.
public enum EcollectError: Error, LocalizedError {
    /// The session token has expired. The SDK will auto-refresh and retry once.
    case sessionExpired(String)
    /// Invalid entity code or service code configuration.
    case invalidConfig(String)
    /// Input validation failed (amount, currency, references, etc.).
    case validation(String)
    /// Card number or expiration date is invalid.
    case invalidCard(String)
    /// A network or server error that can be retried (FAIL_SYSTEM).
    case networkRetryable(String)
    /// Token not found or expired on ecollect.
    case tokenNotFound(String)
    /// MerchantTransactionId already used for another transaction.
    case duplicateTransaction(String)
    /// ApiKey / SessionToken authentication failed.
    case authenticationFailed(String)
    /// Webhook session or ticket verification failed.
    case webhookValidationFailed(String)
    /// Polling timed out without reaching a final transaction state.
    case pollingTimeout(String)
    /// A generic API error with the raw ecollect return code and message.
    case apiError(code: String, message: String)

    public var errorDescription: String? {
        switch self {
        case .sessionExpired(let msg):
            return "Session expired: \(msg)"
        case .invalidConfig(let msg):
            return "Invalid configuration: \(msg)"
        case .validation(let msg):
            return "Validation error: \(msg)"
        case .invalidCard(let msg):
            return "Invalid card: \(msg)"
        case .networkRetryable(let msg):
            return "Network error (retryable): \(msg)"
        case .tokenNotFound(let msg):
            return "Token not found: \(msg)"
        case .duplicateTransaction(let msg):
            return "Duplicate transaction: \(msg)"
        case .authenticationFailed(let msg):
            return "Authentication failed: \(msg)"
        case .webhookValidationFailed(let msg):
            return "Webhook validation failed: \(msg)"
        case .pollingTimeout(let msg):
            return "Polling timeout: \(msg)"
        case .apiError(let code, let message):
            return "API error [\(code)]: \(message)"
        }
    }

    /// Maps an ecollect ReturnCode string to the appropriate EcollectError.
    static func from(returnCode: String, context: String = "") -> EcollectError {
        switch returnCode {
        case "FAIL_APIEXPIREDSESSION":
            return .sessionExpired(context.isEmpty ? "SessionToken has expired" : context)
        case "FAIL_INVALIDENTITYCODE":
            return .invalidConfig("Invalid EntityCode: \(context)")
        case "FAIL_INVALIDSERVICECODE":
            return .invalidConfig("Invalid SrvCode: \(context)")
        case "FAIL_INVALIDCREDITCARD":
            return .invalidCard("Card number failed Luhn check: \(context)")
        case "FAIL_INVALIDEXPIRATIONDATE":
            return .invalidCard("Card expiration date is invalid: \(context)")
        case "FAIL_TOKENNOTFOUND", "FAIL_TOKENEXPIRED":
            return .tokenNotFound("Token not found or expired: \(context)")
        case "FAIL_MERCHANTRANSID":
            return .duplicateTransaction("MerchantTransactionId already used: \(context)")
        case "FAIL_ACCESSDENIED":
            return .authenticationFailed("Access denied — ApiKey invalid or merchant inactive: \(context)")
        case "FAIL_SESSIONNOTFOUND", "FAIL_TICKETIDNOTMATCH":
            return .webhookValidationFailed("Webhook verification failed: \(context)")
        case "FAIL_SYSTEM":
            return .networkRetryable("System error from ecollect: \(context)")
        default:
            return .apiError(code: returnCode, message: context.isEmpty ? returnCode : context)
        }
    }
}
