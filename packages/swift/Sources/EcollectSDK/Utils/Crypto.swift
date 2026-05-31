import CryptoKit
import Foundation

/// Cryptographic utilities using Apple's CryptoKit — no external dependencies.
public enum Crypto {
    /// Computes HMAC-SHA256 and returns the hex-encoded digest.
    /// - Parameters:
    ///   - key: The secret key string.
    ///   - data: The message to authenticate.
    /// - Returns: Lowercase hex string of the HMAC-SHA256 digest.
    public static func hmacSHA256(key: String, data: String) -> String {
        let keyData = SymmetricKey(data: Data(key.utf8))
        let mac = HMAC<SHA256>.authenticationCode(
            for: Data(data.utf8),
            using: keyData
        )
        return Data(mac).map { String(format: "%02x", $0) }.joined()
    }

    /// Verifies that the provided signature matches the expected HMAC-SHA256.
    public static func verifyHMAC(key: String, data: String, signature: String) -> Bool {
        hmacSHA256(key: key, data: data) == signature
    }
}
