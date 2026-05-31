/**
 * PaymentLinksModule: generate payment links via email, SMS, or QR.
 */

import { ValidationException } from '../errors/index.js';
import type { PaymentIntent, PaymentLinkResult, PaymentLinkMethod } from '../types/index.js';
import type { PaymentsModule } from './payments.js';
import type { PaymentInfoItem } from '../types/api.js';

// AttributeCode 35 = LifetimeSecs (for QR)
const QR_LIFETIME_ATTR_CODE = 35;

export class PaymentLinksModule {
  private readonly payments: PaymentsModule;

  constructor(payments: PaymentsModule) {
    this.payments = payments;
  }

  /**
   * Generate a payment link for the given method.
   *
   * - email: sends payment button to customer's email
   * - sms: sends SMS with payment link (requires mobileCountryCode + mobileNumber)
   * - qr: returns QR code link (LifetimeSecs configurable)
   */
  async generatePaymentLink(
    intent: PaymentIntent,
    method: PaymentLinkMethod = 'email',
  ): Promise<PaymentLinkResult> {
    const extraInfo: PaymentInfoItem[] = [];
    const lifetime = intent.qrLifetimeSecs ?? 3600;

    if (method === 'sms') {
      if (!intent.customer.mobileCountryCode || !intent.customer.mobileNumber) {
        throw new ValidationException(
          'customer.mobileCountryCode and customer.mobileNumber are required for SMS payment links',
        );
      }
      extraInfo.push(
        {
          AttributeCode: 7,
          AttributeDesc: 'MobileCountryCode',
          AttributeValue: intent.customer.mobileCountryCode,
        },
        {
          AttributeCode: 8,
          AttributeDesc: 'MobileNumber',
          AttributeValue: intent.customer.mobileNumber,
        },
      );
    } else if (method === 'qr') {
      extraInfo.push({
        AttributeCode: QR_LIFETIME_ATTR_CODE,
        AttributeDesc: 'LifetimeSecs',
        AttributeValue: String(lifetime),
      });
    }
    // email: Usermail is already included by buildPaymentInfoArray in the payments module

    // Build merged intent with PaymentSystem=10 (Link de Pagos)
    const linkIntent: PaymentIntent = {
      ...intent,
      paymentSystem: '10',
    };

    const result = await this.payments._processWithExtraInfo(linkIntent, extraInfo);

    const actualLifetime = result.lifetimeSecs ?? lifetime;
    return {
      eCollectUrl: result.eCollectUrl,
      ticketId: result.ticketId,
      lifetimeSecs: actualLifetime,
      expiresAt: new Date(Date.now() + actualLifetime * 1000),
    };
  }
}
