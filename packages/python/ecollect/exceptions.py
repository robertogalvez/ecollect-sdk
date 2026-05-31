"""Exception hierarchy for the ecollect SDK."""


class EcollectError(Exception):
    """Base exception for all ecollect SDK errors."""

    def __init__(self, message: str = "", return_code: str = "") -> None:
        super().__init__(message)
        self.return_code = return_code


class SessionExpiredError(EcollectError):
    """Raised when the session token has expired (FAIL_APIEXPIREDSESSION)."""


class InvalidConfigError(EcollectError):
    """Raised for invalid entity or service code configuration."""


class ValidationError(EcollectError):
    """Raised when request validation fails."""


class InvalidCardError(EcollectError):
    """Raised for invalid credit card number or expiration date."""


class NetworkRetryableError(EcollectError):
    """Raised on system errors that should be retried with exponential backoff."""


class TokenNotFoundError(EcollectError):
    """Raised when a token is not found or has expired."""


class DuplicateTransactionError(EcollectError):
    """Raised when MerchantTransactionId already exists."""


class AuthenticationError(EcollectError):
    """Raised when access is denied (invalid ApiKey or inactive merchant)."""


class WebhookValidationError(EcollectError):
    """Raised when webhook session/ticket verification fails."""


class CustomerError(EcollectError):
    """Raised for customer-related errors."""


class PollingTimeoutError(EcollectError):
    """Raised when polling exceeds the timeout period."""


# Map ecollect ReturnCode strings to exception classes
RETURN_CODE_MAP: dict = {
    "FAIL_APIEXPIREDSESSION": SessionExpiredError,
    "FAIL_INVALIDENTITYCODE": InvalidConfigError,
    "FAIL_INVALIDSERVICECODE": InvalidConfigError,
    "FAIL_INVALIDCREDITCARD": InvalidCardError,
    "FAIL_INVALIDEXPIRATIONDATE": InvalidCardError,
    "FAIL_TOKENNOTFOUND": TokenNotFoundError,
    "FAIL_TOKENEXPIRED": TokenNotFoundError,
    "FAIL_MERCHANTRANSID": DuplicateTransactionError,
    "FAIL_ACCESSDENIED": AuthenticationError,
    "FAIL_SESSIONNOTFOUND": WebhookValidationError,
    "FAIL_TICKETIDNOTMATCH": WebhookValidationError,
    "FAIL_SYSTEM": NetworkRetryableError,
}


def raise_for_return_code(return_code: str, message: str = "") -> None:
    """Raise the appropriate exception for a given ReturnCode.

    Does nothing if the code is SUCCESS or NO_RECORDS.
    """
    if return_code in ("SUCCESS", "NO_RECORDS", "SUCCESS_ALREADY_CREATED"):
        return
    exc_class = RETURN_CODE_MAP.get(return_code, ValidationError)
    raise exc_class(message or return_code, return_code=return_code)
