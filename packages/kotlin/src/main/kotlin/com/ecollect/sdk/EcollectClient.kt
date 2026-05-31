package com.ecollect.sdk

import com.ecollect.sdk.exceptions.InvalidConfigException
import com.ecollect.sdk.modules.*
import com.ecollect.sdk.utils.HttpClient
import okhttp3.OkHttpClient
import java.util.concurrent.TimeUnit

/**
 * Main entry point for the ecollect SDK.
 *
 * ## Server-side usage (with ApiKey):
 * ```kotlin
 * val client = EcollectClient.Builder()
 *     .apiKey("your-private-api-key")
 *     .etyCode(123)
 *     .environment(Environment.TEST)
 *     .srvCode(456)
 *     .build()
 *
 * val payment = client.payments.process(paymentIntent)
 * ```
 *
 * ## Mobile usage (with SessionToken — ApiKey NEVER on device):
 * ```kotlin
 * // Your backend obtains sessionToken using ApiKey, then passes it to the app
 * val client = EcollectClient.fromSessionToken(
 *     sessionToken = "token-from-backend",
 *     etyCode = 123,
 *     environment = Environment.TEST
 * )
 * ```
 */
class EcollectClient private constructor(
    private val config: Config,
    private val httpClient: HttpClient
) {
    val session: SessionModule = SessionModule(config, httpClient)
    val payments: PaymentsModule = PaymentsModule(config, httpClient, session)
    val tokens: TokensModule = TokensModule(config, httpClient, session)
    val webhooks: WebhooksModule = WebhooksModule(config, httpClient, session)
    val reconciliation: ReconciliationModule = ReconciliationModule(config, httpClient, session)
    val customers: CustomersModule = CustomersModule(config, httpClient, session)
    val paymentSystems: PaymentSystemsModule = PaymentSystemsModule(config, httpClient, session)
    val paymentLinks: PaymentLinksModule = PaymentLinksModule(config, payments, session)

    class Builder {
        private var apiKey: String? = null
        private var sessionToken: String? = null
        private var etyCode: Int? = null
        private var srvCode: Int? = null
        private var environment: Environment = Environment.TEST
        private var okHttpClient: OkHttpClient? = null

        fun apiKey(apiKey: String) = apply { this.apiKey = apiKey }
        fun sessionToken(sessionToken: String) = apply { this.sessionToken = sessionToken }
        fun etyCode(etyCode: Int) = apply { this.etyCode = etyCode }
        fun srvCode(srvCode: Int) = apply { this.srvCode = srvCode }
        fun environment(environment: Environment) = apply { this.environment = environment }
        fun okHttpClient(client: OkHttpClient) = apply { this.okHttpClient = client }

        fun build(): EcollectClient {
            val code = etyCode
                ?: throw InvalidConfigException("etyCode is required")

            if (apiKey == null && sessionToken == null) {
                throw InvalidConfigException(
                    "Either apiKey (server-side) or sessionToken (mobile) must be provided"
                )
            }

            val config = Config(
                etyCode = code,
                apiKey = apiKey,
                sessionToken = sessionToken,
                srvCode = srvCode,
                environment = environment
            )

            val client = okHttpClient ?: OkHttpClient.Builder()
                .connectTimeout(30, TimeUnit.SECONDS)
                .readTimeout(30, TimeUnit.SECONDS)
                .writeTimeout(30, TimeUnit.SECONDS)
                .build()

            return EcollectClient(config, HttpClient(client))
        }
    }

    companion object {
        /**
         * Create a client initialized with a SessionToken (for mobile/frontend use).
         * The ApiKey MUST NOT be stored on mobile devices.
         *
         * @param sessionToken Token obtained by your backend from ecollect
         * @param etyCode Your merchant entity code
         * @param environment TEST or PRODUCTION
         * @param srvCode Optional default service code
         */
        fun fromSessionToken(
            sessionToken: String,
            etyCode: Int,
            environment: Environment = Environment.TEST,
            srvCode: Int? = null
        ): EcollectClient {
            return Builder()
                .sessionToken(sessionToken)
                .etyCode(etyCode)
                .environment(environment)
                .apply { srvCode?.let { srvCode(it) } }
                .build()
        }
    }
}
