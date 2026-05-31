<?php

declare(strict_types=1);

namespace Ecollect\Modules;

use Ecollect\Exceptions\ValidationException;
use Ecollect\Types\PaymentIntent;

/**
 * Generates payment links via email, SMS, or QR code.
 */
class PaymentLinksModule
{
    /** @var PaymentsModule */
    private $payments;

    public function __construct(PaymentsModule $payments)
    {
        $this->payments = $payments;
    }

    /**
     * Generate a payment link.
     *
     * @param  PaymentIntent        $intent
     * @param  string               $method 'email'|'sms'|'qr'
     * @return array<string, mixed>
     * @throws ValidationException
     */
    public function generatePaymentLink(PaymentIntent $intent, string $method = 'email'): array
    {
        $extraInfo = [];
        $lifetime  = $intent->qrLifetimeSecs ?? 3600;

        if ($method === 'sms') {
            if (
                !$intent->customer->mobileCountryCode
                || !$intent->customer->mobileNumber
            ) {
                throw new ValidationException(
                    'customer.mobileCountryCode and customer.mobileNumber are required for SMS payment links'
                );
            }
            $extraInfo[] = ['AttributeCode' => 7, 'AttributeDesc' => 'MobileCountryCode', 'AttributeValue' => $intent->customer->mobileCountryCode];
            $extraInfo[] = ['AttributeCode' => 8, 'AttributeDesc' => 'MobileNumber',      'AttributeValue' => $intent->customer->mobileNumber];
        } elseif ($method === 'qr') {
            $extraInfo[] = ['AttributeCode' => 35, 'AttributeDesc' => 'LifetimeSecs', 'AttributeValue' => (string)$lifetime];
        }
        // email: Usermail is already included by buildPaymentInfoArray in PaymentsModule

        // Clone intent with PaymentSystem = 10 (Link de Pagos)
        $linkIntent                = clone $intent;
        $linkIntent->paymentSystem = '10';

        $result         = $this->payments->processWithExtraInfo($linkIntent, $extraInfo);
        $actualLifetime = $result['lifetimeSecs'] ?? $lifetime;

        return [
            'eCollectUrl'  => $result['eCollectUrl'] ?? null,
            'ticketId'     => $result['ticketId']    ?? null,
            'lifetimeSecs' => $actualLifetime,
            'expiresAt'    => time() + (int)$actualLifetime,
        ];
    }
}
