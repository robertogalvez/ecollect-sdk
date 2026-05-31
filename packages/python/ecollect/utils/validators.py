"""Validation helpers for payment data."""
import re
from typing import Optional

from ecollect.exceptions import InvalidCardError, ValidationError


def luhn_check(card_number: str) -> bool:
    """Return True if card_number passes the Luhn algorithm.

    Note: all-zeros (e.g. '0000000000000000') is mathematically valid.
    The invalid test number is '4111111111111112' (off-by-one from the
    Visa test number 4111111111111111).
    """
    digits = [int(d) for d in card_number if d.isdigit()]
    if len(digits) < 13:
        return False
    total = 0
    for i, digit in enumerate(reversed(digits)):
        if i % 2 == 1:
            digit *= 2
            if digit > 9:
                digit -= 9
        total += digit
    return total % 10 == 0


def validate_card_number(card_number: str) -> None:
    """Validate a credit card number using the Luhn algorithm."""
    cleaned = re.sub(r"\s+", "", card_number)
    if not cleaned.isdigit():
        raise InvalidCardError("Card number must contain only digits")
    if not luhn_check(cleaned):
        raise InvalidCardError(f"Card number {cleaned!r} failed Luhn check")


def validate_expiration_date(expiry: str) -> None:
    """Validate expiration date format MM/YYYY."""
    if not re.match(r"^\d{2}/\d{4}$", expiry):
        raise ValidationError("Expiration date must be in MM/YYYY format")
    month, year = expiry.split("/")
    if not (1 <= int(month) <= 12):
        raise ValidationError("Expiration month must be between 01 and 12")


def validate_email(email: str) -> None:
    """Basic email format validation."""
    if not re.match(r"^[^\s@]+@[^\s@]+\.[^\s@]+$", email):
        raise ValidationError(f"Invalid email format: {email!r}")


def validate_payment_intent(intent: "PaymentIntent") -> None:  # type: ignore[name-defined]
    """Validate a PaymentIntent before sending to the API."""
    from ecollect.types import PaymentIntent  # avoid circular import

    if intent.amount <= 0:
        raise ValidationError("amount must be greater than 0")
    if not intent.currency:
        raise ValidationError("currency is required")
    if not intent.customer:
        raise ValidationError("customer is required")
    if not intent.customer.email:
        raise ValidationError("customer.email is required")
    validate_email(intent.customer.email)


# Country-specific validation rules
_COUNTRY_RULES = {
    "CO": {
        "document_types": {"CC", "NIT", "PP", "CE", "DE"},
        "payment_systems": {0, 1},
        "requires_user_type_for_pse": True,
    },
    "DO": {
        "document_types": {"CI", "RNC", "PP"},
        "payment_systems": {3, 6},
        "requires_user_type_for_pse": False,
    },
    "MX": {
        "document_types": {"CURP", "IFE", "RFC", "PP"},
        "payment_systems": {1, 7},
        "requires_user_type_for_pse": False,
        "spei_no_card": True,
    },
}


def validate_by_country(intent: "PaymentIntent", country: str) -> None:  # type: ignore[name-defined]
    """Apply country-specific validation rules to a PaymentIntent."""
    rules = _COUNTRY_RULES.get(country.upper())
    if not rules:
        return  # unknown country — skip validation

    doc_type = intent.customer.document_type
    if doc_type and doc_type not in rules["document_types"]:
        raise ValidationError(
            f"DocumentType {doc_type!r} is not valid for country {country}"
        )

    ps = intent.payment_system
    if ps is not None and ps not in rules["payment_systems"]:
        raise ValidationError(
            f"PaymentSystem {ps} is not available in country {country}"
        )

    # Colombia PSE (PaymentSystem=0) requires UserType
    if country.upper() == "CO" and ps == 0 and not intent.user_type:
        raise ValidationError("UserType is required for PSE (Colombia)")

    # Mexico SPEI (PaymentSystem=7) cannot use card data
    if country.upper() == "MX" and ps == 7 and intent.token_id:
        raise ValidationError("SPEI (Mexico) does not support card/token data")
