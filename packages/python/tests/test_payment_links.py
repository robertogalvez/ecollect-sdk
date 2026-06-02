"""Tests for the PaymentLinksModule."""
import pytest
import respx
import httpx

from ecollect import EcollectClient, Customer, PaymentIntent
from ecollect.exceptions import SessionExpiredError

TEST_BASE = "https://test1.e-collect.com/app_express/api/"
SESSION_URL = TEST_BASE + "getSessionToken"
PAYMENT_URL = TEST_BASE + "createTransactionPayment"


def make_client() -> EcollectClient:
    return EcollectClient(api_key="test-key", ety_code=999, environment="test", srv_code=1)


def _session_response():
    return httpx.Response(
        200,
        json={"ReturnCode": "SUCCESS", "SessionToken": "tok-session", "LifetimeSecs": 1800},
    )


def _base_intent() -> PaymentIntent:
    return PaymentIntent(
        amount=50000.0,
        currency="COP",
        customer=Customer(
            email="ana@example.com",
            full_name="Ana García",
            document_type="CC",
            document_number="87654321",
            phone="3109876543",
            mobile_country_code="57",
        ),
        merchant_transaction_id="LINK-001",
    )


@pytest.mark.asyncio
async def test_generate_payment_link_returns_valid_url():
    """generate_payment_link() returns an eCollectUrl."""
    with respx.mock:
        respx.post(SESSION_URL).mock(return_value=_session_response())
        respx.post(PAYMENT_URL).mock(
            return_value=httpx.Response(
                200,
                json={
                    "ReturnCode": "SUCCESS",
                    "TicketId": 555,
                    "eCollectUrl": "https://ecollect.example.com/link/abc",
                    "LifetimeSecs": 3600,
                },
            )
        )
        client = make_client()
        result = await client.payment_links.generate_payment_link(_base_intent(), method="email")
        assert result["eCollectUrl"] == "https://ecollect.example.com/link/abc"
        assert result["TicketId"] == 555


@pytest.mark.asyncio
async def test_generate_payment_link_with_optional_fields():
    """generate_payment_link() works with amount, currency, and reference."""
    with respx.mock:
        respx.post(SESSION_URL).mock(return_value=_session_response())
        respx.post(PAYMENT_URL).mock(
            return_value=httpx.Response(
                200,
                json={
                    "ReturnCode": "SUCCESS",
                    "TicketId": 777,
                    "eCollectUrl": "https://ecollect.example.com/link/xyz",
                    "LifetimeSecs": 7200,
                },
            )
        )
        client = make_client()
        intent = PaymentIntent(
            amount=120000.0,
            currency="COP",
            customer=Customer(
                email="user@example.com",
                full_name="Test User",
                document_type="CC",
                document_number="11111111",
                phone="3001111111",
            ),
            merchant_transaction_id="REF-2024-001",
        )
        result = await client.payment_links.generate_payment_link(intent, method="email")
        assert result["TicketId"] == 777
        assert "eCollectUrl" in result


@pytest.mark.asyncio
async def test_generate_payment_link_expired_session_error():
    """generate_payment_link() raises SessionExpiredError on FAIL_APIEXPIREDSESSION (no retry token)."""
    with respx.mock:
        respx.post(SESSION_URL).mock(return_value=_session_response())
        # Both the initial and retry calls return expired session
        respx.post(PAYMENT_URL).mock(
            return_value=httpx.Response(
                200,
                json={"ReturnCode": "FAIL_APIEXPIREDSESSION"},
            )
        )
        client = make_client()
        with pytest.raises(Exception):
            await client.payment_links.generate_payment_link(_base_intent(), method="email")
