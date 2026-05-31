package com.ecollect.sdk

enum class Environment {
    TEST,
    PRODUCTION
}

data class Config(
    val etyCode: Int,
    val apiKey: String? = null,
    val sessionToken: String? = null,
    val srvCode: Int? = null,
    val environment: Environment = Environment.TEST
) {
    val baseUrl: String
        get() = when (environment) {
            Environment.TEST -> URLs.TEST_BASE
            Environment.PRODUCTION -> URLs.PROD_BASE
        }

    val transactionInfoUrl: String
        get() = when (environment) {
            Environment.TEST -> "${URLs.TEST_BASE}getTransactionInformation"
            Environment.PRODUCTION -> URLs.PROD_TRANSACTION_INFO
        }
}

object URLs {
    const val TEST_BASE = "https://test1.e-collect.com/app_express/api/"
    const val PROD_BASE = "https://www.e-collect.com/app_Express/api/"
    const val PROD_TRANSACTION_INFO = "https://m.e-collect.com/app_Express/api/GetTransactionInformation"
}
