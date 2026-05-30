<?php

declare(strict_types=1);

namespace Ecollect\Utils;

use Ecollect\Exceptions\InvalidCardException;
use Ecollect\Exceptions\ValidationException;
use Ecollect\Types\PaymentIntent;

/**
 * Client-side validation utilities.
 */
class Validators
{
    const SUPPORTED_CURRENCIES = ['COP', 'MXN', 'DOP', 'USD', 'EUR'];

    const COUNTRY_RULES = [
        'CO' => [
            'documentTypes'           => ['CC', 'NIT', 'PP', 'CE', 'DE'],
            'paymentSystems'          => [0, 1],
            'requiresUserTypeForPSE'  => true,
        ],
        'DO' => [
            'documentTypes'  => ['CI', 'RNC', 'PP'],
            'paymentSystems' => [3, 6],
        ],
        'MX' => [
            'documentTypes'      => ['CURP', 'IFE', 'RFC', 'PP'],
            'paymentSystems'     => [1, 7],
            'speiRequiresNoCard' => true,
        ],
    ];

    /**
     * Standard Luhn algorithm to validate card numbers.
     */
    public static function luhnCheck(string $cardNumber): bool
    {
        $digits = preg_replace('/\D/', '', $cardNumber);
        $len    = strlen($digits);

        if ($len < 13 || $len > 19) {
            return false;
        }

        $sum          = 0;
        $shouldDouble = false;

        for ($i = $len - 1; $i >= 0; $i--) {
            $digit = (int)$digits[$i];
            if ($shouldDouble) {
                $digit *= 2;
                if ($digit > 9) {
                    $digit -= 9;
                }
            }
            $sum         += $digit;
            $shouldDouble = !$shouldDouble;
        }

        return ($sum % 10) === 0;
    }

    /**
     * Validate email format.
     */
    public static function validateEmail(string $email): bool
    {
        return filter_var($email, FILTER_VALIDATE_EMAIL) !== false;
    }

    /**
     * Validate a PaymentIntent before sending to the API.
     *
     * @param PaymentIntent $intent
     * @param int|null      $configEtyCode
     * @throws ValidationException
     */
    public static function validatePaymentIntent(PaymentIntent $intent, ?int $configEtyCode = null): void
    {
        if ($intent->amount === null || $intent->amount <= 0) {
            throw new ValidationException('amount must be greater than 0');
        }

        if (
            !$intent->currency
            || !in_array(strtoupper($intent->currency), self::SUPPORTED_CURRENCIES, true)
        ) {
            throw new ValidationException(
                "currency \"{$intent->currency}\" is not supported. Supported: "
                . implode(', ', self::SUPPORTED_CURRENCIES)
            );
        }

        if (!$intent->customer) {
            throw new ValidationException('customer is required');
        }

        if (!$intent->customer->email || !self::validateEmail($intent->customer->email)) {
            throw new ValidationException('customer.email is invalid');
        }

        if (!$intent->customer->fullName || trim($intent->customer->fullName) === '') {
            throw new ValidationException('customer.fullName is required');
        }

        if ($configEtyCode === null || $configEtyCode <= 0) {
            throw new ValidationException('etyCode is required (set in EcollectClient config)');
        }
    }

    /**
     * Validate country-specific rules.
     *
     * @param PaymentIntent $intent
     * @param string        $country ISO 3166-1 alpha-2, e.g. "CO", "MX", "DO"
     * @throws ValidationException
     */
    public static function validateByCountry(PaymentIntent $intent, string $country): void
    {
        $rules = self::COUNTRY_RULES[strtoupper($country)] ?? null;
        if ($rules === null) {
            return; // Unknown country: no specific validations
        }

        if (
            $intent->customer->documentType
            && !in_array(strtoupper($intent->customer->documentType), $rules['documentTypes'], true)
        ) {
            throw new ValidationException(
                "documentType \"{$intent->customer->documentType}\" is not valid for country {$country}. "
                . 'Allowed: ' . implode(', ', $rules['documentTypes'])
            );
        }

        if ($intent->paymentSystem !== null) {
            $ps = (int)$intent->paymentSystem;
            if (!in_array($ps, $rules['paymentSystems'], true)) {
                throw new ValidationException(
                    "paymentSystem {$ps} is not available in country {$country}. "
                    . 'Allowed: ' . implode(', ', $rules['paymentSystems'])
                );
            }

            // PSE (paymentSystem=0) requires UserType in Colombia
            if ($ps === 0 && !empty($rules['requiresUserTypeForPSE'])) {
                if ($intent->userType === null || $intent->userType === '') {
                    throw new ValidationException(
                        'userType is required for PSE payments in Colombia (0=Natural, 1=Juridica)'
                    );
                }
            }

            // SPEI (paymentSystem=7) in Mexico cannot have card data
            if ($ps === 7 && !empty($rules['speiRequiresNoCard']) && $intent->tokenId) {
                throw new ValidationException('SPEI payments in Mexico do not support card/token data');
            }
        }
    }

    /**
     * Validate a card number via Luhn check.
     *
     * @throws InvalidCardException
     */
    public static function validateCardNumber(string $cardNumber): void
    {
        if (!self::luhnCheck($cardNumber)) {
            throw new InvalidCardException('Card number failed Luhn check');
        }
    }

    /**
     * Validate expiration date in MM/YYYY format and that it's not in the past.
     *
     * @throws InvalidCardException
     */
    public static function validateExpirationDate(string $expiry): void
    {
        if (!preg_match('/^(\d{2})\/(\d{4})$/', $expiry, $matches)) {
            throw new InvalidCardException('expirationDate must be in MM/YYYY format');
        }

        $month = (int)$matches[1];
        $year  = (int)$matches[2];

        if ($month < 1 || $month > 12) {
            throw new InvalidCardException('expirationDate month is out of range');
        }

        $now         = new \DateTime('first day of this month');
        $expiryDate  = new \DateTime("{$year}-{$month}-01");

        if ($expiryDate < $now) {
            throw new InvalidCardException('Card has expired');
        }
    }
}
