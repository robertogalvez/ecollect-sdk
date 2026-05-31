package com.ecollect.sdk.utils

import javax.crypto.Mac
import javax.crypto.spec.SecretKeySpec

object Crypto {
    fun hmacSha256(data: String, key: String): String {
        val mac = Mac.getInstance("HmacSHA256")
        val secretKey = SecretKeySpec(key.toByteArray(Charsets.UTF_8), "HmacSHA256")
        mac.init(secretKey)
        val bytes = mac.doFinal(data.toByteArray(Charsets.UTF_8))
        return bytes.joinToString("") { "%02x".format(it) }
    }

    fun verifyHmac(data: String, key: String, expectedSignature: String): Boolean {
        val computed = hmacSha256(data, key)
        // Constant-time comparison to prevent timing attacks
        if (computed.length != expectedSignature.length) return false
        var result = 0
        for (i in computed.indices) {
            result = result or (computed[i].code xor expectedSignature[i].code)
        }
        return result == 0
    }
}
