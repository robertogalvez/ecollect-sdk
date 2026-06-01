"""Tests for the CustomersModule."""
import pytest
import respx
import httpx

from ecollect import EcollectClient
from ecollect.exceptions import CustomerError

TEST_BASE = "https://test1.e-collect.com/app_express/api/"
SESSION_URL = TEST_BASE + "getSessionToken"
CUSTOMER_URL = TEST_BASE + "getCustomerId"


def make_client() -> EcollectClient:
    return EcollectClient(api_key="test-key", ety_code=999, environment="test")


def _session_response():
    return httpx.Response(
        200,
        json={"ReturnCode": "SUCCESS", "SessionToken": "tok-session", "LifetimeSecs": 1800},
    )


@pytest.mark.asyncio
async def test_get_or_create_customer_id_new_customer():
    """get_or_create_customer_id() returns CustomerId for a new customer."""
    with respx.mock:
        respx.post(SESSION_URL).mock(return_value=_session_response())
        respx.post(CUSTOMER_URL).mock(
            return_value=httpx.Response(
                200,
                json={
                    "ReturnCode": "SUCCESS",
                    "CustomerInfoArray": [
                        {"AttributeCode": 36, "AttributeDesc": "CustomerId", "AttributeValue": "cust_001"},
                    ],
                },
            )
        )
        client = make_client()
        result = await client.customers.get_or_create_customer_id(
            email="juan@example.com",
            card_holder_id="12345678",
            card_holder_name="Juan Perez",
            card_holder_id_type="CC",
            mobile_country_code="57",
            mobile_number="3001234567",
        )
        assert result == "cust_001"


@pytest.mark.asyncio
async def test_get_or_create_customer_id_existing_customer():
    """get_or_create_customer_id() returns the same CustomerId for an existing customer."""
    with respx.mock:
        respx.post(SESSION_URL).mock(return_value=_session_response())
        route = respx.post(CUSTOMER_URL).mock(
            return_value=httpx.Response(
                200,
                json={
                    "ReturnCode": "SUCCESS",
                    "CustomerInfoArray": [
                        {"AttributeCode": 36, "AttributeDesc": "CustomerId", "AttributeValue": "cust_existing_999"},
                    ],
                },
            )
        )
        client = make_client()

        result1 = await client.customers.get_or_create_customer_id(
            email="juan@example.com",
            card_holder_id="12345678",
            card_holder_name="Juan Perez",
            card_holder_id_type="CC",
            mobile_country_code="57",
            mobile_number="3001234567",
        )
        result2 = await client.customers.get_or_create_customer_id(
            email="juan@example.com",
            card_holder_id="12345678",
            card_holder_name="Juan Perez",
            card_holder_id_type="CC",
            mobile_country_code="57",
            mobile_number="3001234567",
        )

        assert result1 == "cust_existing_999"
        assert result2 == "cust_existing_999"


@pytest.mark.asyncio
async def test_update_customer_info_success():
    """update_customer_info() succeeds and returns the CustomerId unchanged."""
    with respx.mock:
        respx.post(SESSION_URL).mock(return_value=_session_response())
        respx.post(CUSTOMER_URL).mock(
            return_value=httpx.Response(
                200,
                json={
                    "ReturnCode": "SUCCESS",
                    "CustomerInfoArray": [
                        {"AttributeCode": 36, "AttributeDesc": "CustomerId", "AttributeValue": "cust_upd_001"},
                    ],
                },
            )
        )
        client = make_client()
        result = await client.customers.update_customer_info(
            customer_id="cust_upd_001",
            email="new@example.com",
            card_holder_name="New Name",
        )
        assert result == "cust_upd_001"


@pytest.mark.asyncio
async def test_update_customer_info_not_found():
    """update_customer_info() raises on FAIL_CUSTOMERNOTFOUND."""
    with respx.mock:
        respx.post(SESSION_URL).mock(return_value=_session_response())
        respx.post(CUSTOMER_URL).mock(
            return_value=httpx.Response(
                200,
                json={"ReturnCode": "FAIL_CUSTOMERNOTFOUND"},
            )
        )
        client = make_client()
        with pytest.raises(Exception):
            await client.customers.update_customer_info(
                customer_id="bad_cust",
                email="x@example.com",
            )
