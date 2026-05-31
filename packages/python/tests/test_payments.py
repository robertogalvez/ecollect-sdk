"""Tests for payment processing."""
import pytest
import respx
import httpx

from ecollect import EcollectClient, Customer, PaymentIntent
from ecollect.exceptions import (
    DuplicateTransactionError,
    InvalidCardError,
    NetworkRetryableError,
    SessionExpiredError,
    TokenNotFoundError,
    ValidationError,
)

TEST_BASE = "https://test1.e-collect.com/app_express/api/"
SESSION_URL = TEST_BASE + "getSessionToken"
PAYMENT_URL = TEST_BASE + "createTransactionPayment"


def make_client() -> EcollectClient:
    return EcollectClient(api_key="key", ety_code=100, environment="test", srv_code=1)


def _session_response():
    return httpx.Response(
        200,
        json={"ReturnCode": "SUCCESS", "SessionToken": "session-tok", "LifetimeSecs": 1800},
    )


def _payment_intent() -> PaymentIntent:
    return PaymentIntent(
        amount=50000.0,
        currency="COP",
        customer=Customer(
            email="user@example.com",
            full_name="Juan Pérez",
            document_type="CC",
            document_number="12345678",
            phone="3001234567",
        ),
        merchant_transaction_id="order-001",
    )


@pytest.mark.asyncio
async def test_process_payment_happy_path():
    """process() returns response dict with TicketId on SUCCESS."""
    with respx.mock:
        respx.post(SESSION_URL).mock(return_value=_session_response())
        respx.post(PAYMENT_URL).mock(
            return_value=httpx.Response(
                200,
                json={"ReturnCode": "SUCCESS", "TicketId": 123456, "TranState": "OK"},
            )
        )
        client = make_client()
        result = await client.payments.process(_payment_intent())
        assert result["TicketId"] == 123456
        assert result["TranState"] == "OK"


@pytest.mark.asyncio
async def test_process_payment_session_expired_auto_refresh():
    """process() auto-refreshes session on FAIL_APIEXPIREDSESSION and retries."""
    with respx.mock:
        # First session call during initial setup; second after expiry
        session_route = respx.post(SESSION_URL).mock(
            return_value=_session_response()
        )
        payment_route = respx.post(PAYMENT_URL).mock(
            side_effect=[
                httpx.Response(200, json={"ReturnCode": "FAIL_APIEXPIREDSESSION"}),
                httpx.Response(200, json={"ReturnCode": "SUCCESS", "TicketId": 99}),
            ]
        )
        client = make_client()
        result = await client.payments.process(_payment_intent())
        assert result["TicketId"] == 99
        # Session should have been refreshed (called at least twice)
        assert session_route.call_count >= 2


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "return_code, exc_class",
    [
        ("FAIL_INVALIDCREDITCARD", InvalidCardError),
        ("FAIL_TOKENNOTFOUND", TokenNotFoundError),
        ("FAIL_TOKENEXPIRED", TokenNotFoundError),
        ("FAIL_MERCHANTRANSID", DuplicateTransactionError),
        ("FAIL_INVALIDREFERENCE1", ValidationError),
    ],
)
async def test_error_code_mapping(return_code, exc_class):
    """ReturnCode values map to correct exception classes."""
    with respx.mock:
        respx.post(SESSION_URL).mock(return_value=_session_response())
        respx.post(PAYMENT_URL).mock(
            return_value=httpx.Response(200, json={"ReturnCode": return_code})
        )
        client = make_client()
        with pytest.raises(exc_class):
            await client.payments.process(_payment_intent())


@pytest.mark.asyncio
async def test_retry_on_fail_system():
    """FAIL_SYSTEM triggers 3 retry attempts with exponential backoff (mocked sleep)."""
    import asyncio

    sleep_calls = []
    original_sleep = asyncio.sleep

    async def mock_sleep(seconds):
        sleep_calls.append(seconds)

    with respx.mock:
        respx.post(SESSION_URL).mock(return_value=_session_response())
        payment_route = respx.post(PAYMENT_URL).mock(
            side_effect=[
                httpx.Response(200, json={"ReturnCode": "FAIL_SYSTEM"}),
                httpx.Response(200, json={"ReturnCode": "FAIL_SYSTEM"}),
                httpx.Response(200, json={"ReturnCode": "SUCCESS", "TicketId": 77}),
            ]
        )
        client = make_client()

        # Patch asyncio.sleep inside the http module
        import ecollect.utils.http as http_mod
        http_mod.asyncio.sleep = mock_sleep  # type: ignore[attr-defined]
        try:
            result = await client.payments.process(_payment_intent())
        finally:
            http_mod.asyncio.sleep = original_sleep

        assert result["TicketId"] == 77
        # Verify exponential backoff: 2^0=1, 2^1=2
        assert sleep_calls == [1, 2]


@pytest.mark.asyncio
async def test_pre_authorize():
    """pre_authorize() sends RequestType=1."""
    with respx.mock:
        respx.post(SESSION_URL).mock(return_value=_session_response())
        route = respx.post(PAYMENT_URL).mock(
            return_value=httpx.Response(
                200, json={"ReturnCode": "SUCCESS", "TicketId": 55}
            )
        )
        client = make_client()
        result = await client.payments.pre_authorize(_payment_intent())
        assert result["TicketId"] == 55
        # Verify RequestType=1 was sent
        request_body = route.calls[0].request
        import json
        body = json.loads(request_body.content)
        assert body["RequestType"] == 1
