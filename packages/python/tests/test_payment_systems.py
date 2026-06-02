"""Tests for the PaymentSystemsModule."""
import pytest
import respx
import httpx

from ecollect import EcollectClient

TEST_BASE = "https://test1.e-collect.com/app_express/api/"
SESSION_URL = TEST_BASE + "getSessionToken"
PAYMENT_SYSTEMS_URL = TEST_BASE + "getPaymentSystem"


def make_client() -> EcollectClient:
    return EcollectClient(api_key="test-key", ety_code=999, environment="test")


def _session_response():
    return httpx.Response(
        200,
        json={"ReturnCode": "SUCCESS", "SessionToken": "tok-session", "LifetimeSecs": 1800},
    )


@pytest.mark.asyncio
async def test_get_payment_systems_returns_array():
    """get_payment_systems() returns a list with PaymentSystem entries."""
    with respx.mock:
        respx.post(SESSION_URL).mock(return_value=_session_response())
        respx.post(PAYMENT_SYSTEMS_URL).mock(
            return_value=httpx.Response(
                200,
                json={
                    "ReturnCode": "SUCCESS",
                    "PaymentSystemArray": [
                        {"PaymentSystem": "1", "BrandImageUrl": "https://cdn.example.com/visa.png"},
                        {"PaymentSystem": "0", "BrandImageUrl": "https://cdn.example.com/pse.png"},
                    ],
                },
            )
        )
        client = make_client()
        result = await client.payment_systems.get_payment_systems()
        assert len(result) == 2
        assert result[0]["PaymentSystem"] == "1"
        assert result[1]["PaymentSystem"] == "0"


@pytest.mark.asyncio
async def test_get_payment_systems_parses_fi_array():
    """get_payment_systems() correctly returns FiArray with FiCode and FiName."""
    with respx.mock:
        respx.post(SESSION_URL).mock(return_value=_session_response())
        respx.post(PAYMENT_SYSTEMS_URL).mock(
            return_value=httpx.Response(
                200,
                json={
                    "ReturnCode": "SUCCESS",
                    "PaymentSystemArray": [
                        {
                            "PaymentSystem": "0",
                            "FiArray": [
                                {"FiCode": "BCOLOMBIA", "FiName": "Bancolombia"},
                                {"FiCode": "DAVIVIENDA", "FiName": "Davivienda"},
                            ],
                        }
                    ],
                },
            )
        )
        client = make_client()
        result = await client.payment_systems.get_payment_systems()
        assert len(result) == 1
        fi_array = result[0].get("FiArray", [])
        assert len(fi_array) == 2
        assert fi_array[0]["FiCode"] == "BCOLOMBIA"
        assert fi_array[0]["FiName"] == "Bancolombia"
        assert fi_array[1]["FiCode"] == "DAVIVIENDA"


@pytest.mark.asyncio
async def test_get_payment_systems_empty_when_no_records():
    """get_payment_systems() returns empty list when no PaymentSystemArray."""
    with respx.mock:
        respx.post(SESSION_URL).mock(return_value=_session_response())
        respx.post(PAYMENT_SYSTEMS_URL).mock(
            return_value=httpx.Response(
                200,
                json={"ReturnCode": "SUCCESS", "PaymentSystemArray": []},
            )
        )
        client = make_client()
        result = await client.payment_systems.get_payment_systems()
        assert result == []
