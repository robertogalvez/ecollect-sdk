<?php

declare(strict_types=1);

namespace Ecollect\Tests;

use Ecollect\Exceptions\InvalidCardException;
use Ecollect\Exceptions\ValidationException;
use Ecollect\Types\Customer;
use Ecollect\Types\PaymentIntent;
use Ecollect\Utils\Validators;
use PHPUnit\Framework\TestCase;

class ValidatorsTest extends TestCase
{
    // -------------------------------------------------------------------------
    // Luhn tests
    // -------------------------------------------------------------------------

    /** @dataProvider validCardProvider */
    public function testLuhnValidCards(string $card): void
    {
        $this->assertTrue(Validators::luhnCheck($card), "Expected {$card} to pass Luhn");
    }

    /** @dataProvider invalidCardProvider */
    public function testLuhnInvalidCards(string $card): void
    {
        $this->assertFalse(Validators::luhnCheck($card), "Expected {$card} to fail Luhn");
    }

    public function validCardProvider(): array
    {
        return [
            ['4111111111111111'], // Visa test
            ['5500005555555559'], // Mastercard test
            ['371449635398431'],  // Amex test
            ['6011111111111117'], // Discover test
        ];
    }

    public function invalidCardProvider(): array
    {
        return [
            ['1234567890123456'],
            ['4111111111111112'],
            ['5500005555555550'],
        ];
    }

    // -------------------------------------------------------------------------
    // Expiry date tests
    // -------------------------------------------------------------------------

    public function testValidExpiryDate(): void
    {
        Validators::validateExpirationDate('12/2099'); // Should not throw
        $this->assertTrue(true);
    }

    public function testInvalidExpiryFormat(): void
    {
        $this->expectException(InvalidCardException::class);
        Validators::validateExpirationDate('12/99');
    }

    public function testExpiredCard(): void
    {
        $this->expectException(InvalidCardException::class);
        Validators::validateExpirationDate('01/2000');
    }

    public function testInvalidMonth(): void
    {
        $this->expectException(InvalidCardException::class);
        Validators::validateExpirationDate('13/2099');
    }

    // -------------------------------------------------------------------------
    // PaymentIntent validation tests
    // -------------------------------------------------------------------------

    private function validIntent(): PaymentIntent
    {
        return new PaymentIntent([
            'amount'   => 100.0,
            'currency' => 'COP',
            'customer' => new Customer([
                'email'     => 'user@example.com',
                'full_name' => 'Juan Perez',
            ]),
        ]);
    }

    public function testValidPaymentIntent(): void
    {
        Validators::validatePaymentIntent($this->validIntent(), 123);
        $this->assertTrue(true);
    }

    public function testAmountMustBePositive(): void
    {
        $intent         = $this->validIntent();
        $intent->amount = 0;

        $this->expectException(ValidationException::class);
        $this->expectExceptionMessageMatches('/amount must be greater than 0/');
        Validators::validatePaymentIntent($intent, 123);
    }

    public function testInvalidCurrency(): void
    {
        $intent           = $this->validIntent();
        $intent->currency = 'XYZ';

        $this->expectException(ValidationException::class);
        $this->expectExceptionMessageMatches('/currency/');
        Validators::validatePaymentIntent($intent, 123);
    }

    public function testInvalidEmail(): void
    {
        $intent                  = $this->validIntent();
        $intent->customer->email = 'not-an-email';

        $this->expectException(ValidationException::class);
        $this->expectExceptionMessageMatches('/email/');
        Validators::validatePaymentIntent($intent, 123);
    }

    public function testRequiresFullName(): void
    {
        $intent                    = $this->validIntent();
        $intent->customer->fullName = '';

        $this->expectException(ValidationException::class);
        Validators::validatePaymentIntent($intent, 123);
    }

    // -------------------------------------------------------------------------
    // Country-specific validation tests
    // -------------------------------------------------------------------------

    public function testColombiaValidDocTypes(): void
    {
        $intent                        = $this->validIntent();
        $intent->customer->documentType = 'CC';
        $intent->paymentSystem          = '1';

        Validators::validateByCountry($intent, 'CO');
        $this->assertTrue(true);
    }

    public function testColombiaInvalidDocType(): void
    {
        $intent                        = $this->validIntent();
        $intent->customer->documentType = 'CURP'; // Mexican doc type

        $this->expectException(ValidationException::class);
        Validators::validateByCountry($intent, 'CO');
    }

    public function testColombiaRequiresUserTypeForPSE(): void
    {
        $intent                = $this->validIntent();
        $intent->paymentSystem = '0'; // PSE
        $intent->userType      = null;

        $this->expectException(ValidationException::class);
        $this->expectExceptionMessageMatches('/userType/');
        Validators::validateByCountry($intent, 'CO');
    }

    public function testColombiaValidPSEWithUserType(): void
    {
        $intent                = $this->validIntent();
        $intent->paymentSystem = '0'; // PSE
        $intent->userType      = '0'; // Natural

        Validators::validateByCountry($intent, 'CO');
        $this->assertTrue(true);
    }

    public function testMexicoSPEICannotHaveToken(): void
    {
        $intent                = $this->validIntent();
        $intent->paymentSystem = '7'; // SPEI
        $intent->tokenId       = 'some-token';

        $this->expectException(ValidationException::class);
        Validators::validateByCountry($intent, 'MX');
    }

    public function testUnknownCountryPassesValidation(): void
    {
        $intent = $this->validIntent();
        Validators::validateByCountry($intent, 'ZZ'); // Unknown — should not throw
        $this->assertTrue(true);
    }
}
