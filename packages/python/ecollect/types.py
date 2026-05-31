"""Public-facing dataclass types for the ecollect SDK."""
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional


@dataclass
class Customer:
    """Represents a customer/payer."""

    email: str
    full_name: str
    document_type: Optional[str] = None  # CC, NIT, PP, CE, RFC, etc.
    document_number: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    mobile_country_code: Optional[str] = None  # e.g. "57" for Colombia


@dataclass
class PaymentIntent:
    """Represents a payment transaction intent."""

    amount: float
    currency: str  # ISO 4217: COP, MXN, DOP, USD
    customer: Customer
    ety_code: Optional[int] = None
    srv_code: Optional[int] = None
    payment_system: Optional[int] = None  # see PaymentSystem Values
    fi_code: Optional[str] = None
    token_id: Optional[str] = None
    secure_code: Optional[str] = None  # CVV
    installments: Optional[int] = None
    vat_value: Optional[float] = None
    merchant_transaction_id: Optional[str] = None
    url_redirect: Optional[str] = None
    url_response: Optional[str] = None
    lang_code: str = "ES"
    request_type: Optional[Any] = None  # 0, 1, TicketId, or -TicketId
    invoice: Optional[str] = None
    invoice_due_date: Optional[str] = None  # yyyyMMddHHmmss
    policy_code: Optional[str] = None
    user_type: Optional[str] = None  # PSE Colombia: "0" or "1"
    ip_address: Optional[str] = None
    device_fingerprint: Optional[str] = None
    one_time_password: Optional[str] = None
    account_type: Optional[int] = None  # 0=credit, 1=debit
    extra_payment_info: List[Dict[str, Any]] = field(default_factory=list)
    subservices: List[Dict[str, Any]] = field(default_factory=list)


@dataclass
class SavedCard:
    """Represents a tokenized/saved card."""

    token_id: str
    masked_card: Optional[str] = None  # e.g. "VISA 5404****1234"
    last4: Optional[str] = None
    fi_code: Optional[str] = None
    fi_name: Optional[str] = None
    payment_system: Optional[str] = None
    brand_image_url: Optional[str] = None
    customer_id: Optional[str] = None
    token_status: Optional[str] = None  # ACTIVE, VERIFY, EXPIRED
    lifetime_secs: Optional[int] = None
    one_time_password: Optional[bool] = None
