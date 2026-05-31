"""Tests for validation utilities."""
import pytest

from ecollect.exceptions import InvalidCardError, ValidationError
from ecollect.utils.validators import (
    luhn_check,
    validate_card_number,
    validate_by_country,
    validate_payment_intent,
)
from ecollect.types import Customer, PaymentIntent


class TestLuhnCheck:
    def test_valid_visa_test_number(self):
        assert luhn_check("4111111111111111") is True

    def test_valid_mastercard(self):
        assert luhn_check("5500005555555559") is True

    def test_invalid_number_off_by_one(self):
        # 4111111111111112 is deliberately invalid (off by one from Visa test number)
        assert luhn_check("4111111111111112") is False

    def test_all_zeros_is_valid(self):
        # Mathematically valid per Luhn; must NOT be rejected
        assert luhn_check("0000000000000000") is True

    def test_too_short(self):
        assert luhn_check("123") is False

    def test_invalid_amex(self):
        assert luhn_check("370000000000001") is False


class TestValidateCardNumber:
    def test_valid_card_passes(self):
        validate_card_number("4111111111111111")  # should not raise

    def test_spaces_stripped(self):
        validate_card_number("4111 1111 1111 1111")  # should not raise

    def test_invalid_card_raises(self):
        with pytest.raises(InvalidCardError):
            validate_card_number("4111111111111112")

    def test_non_digits_raise(self):
        with pytest.raises(InvalidCardError):
            validate_card_number("4111-ABCD-1111-1111")


class TestValidateByCountry:
    def _make_intent(self, payment_system=None, document_type=None, token_id=None, user_type=None):
        return PaymentIntent(
            amount=1000,
            currency="COP",
            customer=Customer(
                email="a@b.com",
                full_name="Test",
                document_type=document_type,
            ),
            payment_system=payment_system,
            token_id=token_id,
            user_type=user_type,
        )

    def test_colombia_pse_requires_user_type(self):
        intent = self._make_intent(payment_system=0, document_type="CC")
        with pytest.raises(ValidationError, match="UserType"):
            validate_by_country(intent, "CO")

    def test_colombia_pse_with_user_type_passes(self):
        intent = self._make_intent(payment_system=0, document_type="CC", user_type="0")
        validate_by_country(intent, "CO")  # should not raise

    def test_mexico_spei_no_card(self):
        intent = self._make_intent(payment_system=7, token_id="tok-123")
        with pytest.raises(ValidationError, match="SPEI"):
            validate_by_country(intent, "MX")

    def test_invalid_document_type_for_colombia(self):
        intent = self._make_intent(payment_system=1, document_type="IFE")
        with pytest.raises(ValidationError, match="DocumentType"):
            validate_by_country(intent, "CO")

    def test_unknown_country_passes(self):
        intent = self._make_intent()
        validate_by_country(intent, "XX")  # unknown country — should not raise


class TestValidatePaymentIntent:
    def test_valid_intent_passes(self):
        intent = PaymentIntent(
            amount=100.0,
            currency="COP",
            customer=Customer(email="user@test.com", full_name="Test"),
        )
        validate_payment_intent(intent)

    def test_negative_amount_raises(self):
        intent = PaymentIntent(
            amount=-10.0,
            currency="COP",
            customer=Customer(email="user@test.com", full_name="Test"),
        )
        with pytest.raises(ValidationError, match="amount"):
            validate_payment_intent(intent)

    def test_invalid_email_raises(self):
        intent = PaymentIntent(
            amount=100.0,
            currency="COP",
            customer=Customer(email="not-an-email", full_name="Test"),
        )
        with pytest.raises(ValidationError):
            validate_payment_intent(intent)
