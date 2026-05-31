"""Tests for exception hierarchy and ReturnCode mapping."""
import pytest

from ecollect.exceptions import (
    AuthenticationError,
    DuplicateTransactionError,
    EcollectError,
    InvalidCardError,
    InvalidConfigError,
    NetworkRetryableError,
    SessionExpiredError,
    TokenNotFoundError,
    ValidationError,
    WebhookValidationError,
    raise_for_return_code,
)


class TestExceptionHierarchy:
    def test_all_exceptions_inherit_ecollect_error(self):
        for exc_class in [
            SessionExpiredError,
            InvalidConfigError,
            ValidationError,
            InvalidCardError,
            NetworkRetryableError,
            TokenNotFoundError,
            DuplicateTransactionError,
            AuthenticationError,
            WebhookValidationError,
        ]:
            assert issubclass(exc_class, EcollectError)

    def test_exception_stores_return_code(self):
        exc = SessionExpiredError("expired", return_code="FAIL_APIEXPIREDSESSION")
        assert exc.return_code == "FAIL_APIEXPIREDSESSION"


class TestRaiseForReturnCode:
    @pytest.mark.parametrize(
        "code, exc_class",
        [
            ("FAIL_APIEXPIREDSESSION", SessionExpiredError),
            ("FAIL_INVALIDENTITYCODE", InvalidConfigError),
            ("FAIL_INVALIDSERVICECODE", InvalidConfigError),
            ("FAIL_INVALIDCREDITCARD", InvalidCardError),
            ("FAIL_INVALIDEXPIRATIONDATE", InvalidCardError),
            ("FAIL_TOKENNOTFOUND", TokenNotFoundError),
            ("FAIL_TOKENEXPIRED", TokenNotFoundError),
            ("FAIL_MERCHANTRANSID", DuplicateTransactionError),
            ("FAIL_ACCESSDENIED", AuthenticationError),
            ("FAIL_SESSIONNOTFOUND", WebhookValidationError),
            ("FAIL_TICKETIDNOTMATCH", WebhookValidationError),
            ("FAIL_SYSTEM", NetworkRetryableError),
            ("FAIL_UNKNOWN_CODE", ValidationError),
        ],
    )
    def test_return_code_maps_to_exception(self, code, exc_class):
        with pytest.raises(exc_class):
            raise_for_return_code(code)

    def test_success_does_not_raise(self):
        raise_for_return_code("SUCCESS")  # should not raise

    def test_no_records_does_not_raise(self):
        raise_for_return_code("NO_RECORDS")

    def test_success_already_created_does_not_raise(self):
        raise_for_return_code("SUCCESS_ALREADY_CREATED")
