package com.ecollect.sdk.modules

import com.ecollect.sdk.Config
import com.ecollect.sdk.types.*
import com.ecollect.sdk.utils.Validators

enum class PaymentLinkMethod {
    EMAIL,
    SMS,
    QR
}

data class PaymentLinkResult(
    val ticketId: Long?,
    val eCollectUrl: String?,
    val lifetimeSecs: Int?
)

class PaymentLinksModule(
    private val config: Config,
    private val paymentsModule: PaymentsModule,
    private val sessionModule: SessionModule
) {
    /**
     * Generate a payment link (PaymentSystem=10) and optionally send via email, SMS, or return QR.
     *
     * @param intent Base payment intent (amount, currency, referenceArray, etc.)
     * @param method How to deliver the link: EMAIL (default), SMS (requires mobileCountryCode + mobileNumber), or QR
     * @param lifetimeSecs Link lifetime in seconds (default 3600 = 1 hour, parametrizable)
     */
    suspend fun generatePaymentLink(
        intent: PaymentIntent,
        method: PaymentLinkMethod = PaymentLinkMethod.EMAIL,
        lifetimeSecs: Int = 3600
    ): PaymentLinkResult {
        Validators.validatePaymentIntent(intent)

        val extraInfo = mutableListOf<PaymentInfoType>()
        intent.extraPaymentInfo?.let { extraInfo.addAll(it) }

        when (method) {
            PaymentLinkMethod.SMS -> {
                requireNotNull(intent.mobileCountryCode) {
                    "mobileCountryCode is required for SMS payment link"
                }
                requireNotNull(intent.mobileNumber) {
                    "mobileNumber is required for SMS payment link"
                }
                // mobileCountryCode and mobileNumber already handled in PaymentsModule
            }
            PaymentLinkMethod.QR -> {
                // LifetimeSecs is passed as attribute 35
                extraInfo.add(PaymentInfoType(35, "LifetimeSecs", lifetimeSecs.toString()))
            }
            PaymentLinkMethod.EMAIL -> {
                // Usermail is handled by PaymentsModule from intent.usermail
                requireNotNull(intent.usermail) {
                    "usermail is required for email payment link"
                }
            }
        }

        val linkIntent = intent.copy(
            paymentSystem = "10",  // Link de Pagos
            extraPaymentInfo = extraInfo
        )

        val response = paymentsModule.process(linkIntent)
        return PaymentLinkResult(
            ticketId = response.ticketId,
            eCollectUrl = response.eCollectUrl,
            lifetimeSecs = response.lifetimeSecs
        )
    }
}
