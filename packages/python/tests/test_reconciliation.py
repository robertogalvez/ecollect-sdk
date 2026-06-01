"""Tests for the ReconciliationModule."""
import pytest
import respx
import httpx
from unittest.mock import AsyncMock, patch

from ecollect import EcollectClient
from ecollect.exceptions import PollingTimeoutError

TEST_BASE = "https://test1.e-collect.com/app_express/api/"
SESSION_URL = TEST_BASE + "getSessionToken"
TX_STATUS_URL = TEST_BASE + "getTransactionInformation"


def make_client() -> EcollectClient:
    return EcollectClient(api_key="test-key", ety_code=999, environment="test")


def _session_response():
    return httpx.Response(
        200,
        json={"ReturnCode": "SUCCESS", "SessionToken": "tok-session", "LifetimeSecs": 1800},
    )


@pytest.mark.asyncio
async def test_get_transaction_status_approved():
    """get_transaction_status() returns OK status for an approved transaction."""
    with respx.mock:
        respx.post(SESSION_URL).mock(return_value=_session_response())
        respx.post(TX_STATUS_URL).mock(
            return_value=httpx.Response(
                200,
                json={
                    "ReturnCode": "SUCCESS",
                    "TicketId": 999,
                    "TranState": "OK",
                    "TrazabilityCode": "TRAZ-001",
                    "TransValue": 100000,
                    "PayCurrency": "COP",
                },
            )
        )
        client = make_client()
        result = await client.reconciliation.get_transaction_status(999)
        assert result["ReturnCode"] == "SUCCESS"
        assert result["TranState"] == "OK"
        assert result["TrazabilityCode"] == "TRAZ-001"


@pytest.mark.asyncio
async def test_get_transaction_status_pending():
    """get_transaction_status() returns PENDING state for in-progress transaction."""
    with respx.mock:
        respx.post(SESSION_URL).mock(return_value=_session_response())
        respx.post(TX_STATUS_URL).mock(
            return_value=httpx.Response(
                200,
                json={
                    "ReturnCode": "SUCCESS",
                    "TicketId": 777,
                    "TranState": "PENDING",
                },
            )
        )
        client = make_client()
        result = await client.reconciliation.get_transaction_status(777)
        assert result["TranState"] == "PENDING"
        assert result["TicketId"] == 777


@pytest.mark.asyncio
async def test_reconciliate_resolves_after_2_polls():
    """reconciliate() resolves when transaction reaches final state after 2 polls."""
    call_count = 0

    async def mock_get_status(ticket_id: int):
        nonlocal call_count
        call_count += 1
        if call_count == 1:
            return {"ReturnCode": "SUCCESS", "TicketId": ticket_id, "TranState": "PENDING"}
        return {"ReturnCode": "SUCCESS", "TicketId": ticket_id, "TranState": "OK", "TrazabilityCode": "TRAZ-FINAL"}

    client = make_client()

    with patch.object(client.reconciliation, "get_transaction_status", side_effect=mock_get_status):
        with patch("ecollect.utils.polling.asyncio.sleep", new_callable=AsyncMock):
            result = await client.reconciliation.reconciliate(100, timeout=600)

    assert result["TranState"] == "OK"
    assert result.get("TrazabilityCode") == "TRAZ-FINAL"
    assert call_count == 2


@pytest.mark.asyncio
async def test_reconciliate_raises_timeout():
    """reconciliate() raises PollingTimeoutError when timeout is exceeded."""
    async def mock_get_status(ticket_id: int):
        return {"ReturnCode": "SUCCESS", "TicketId": ticket_id, "TranState": "PENDING"}

    client = make_client()

    with patch.object(client.reconciliation, "get_transaction_status", side_effect=mock_get_status):
        with patch("ecollect.utils.polling.asyncio.sleep", new_callable=AsyncMock):
            with pytest.raises(PollingTimeoutError):
                # timeout=0 forces immediate timeout after first non-terminal poll
                await client.reconciliation.reconciliate(200, timeout=0)


@pytest.mark.asyncio
async def test_reconciliate_uses_30s_interval_for_pending():
    """reconciliate() waits 30 seconds between polls for PENDING state."""
    sleep_calls = []

    async def mock_sleep(seconds):
        sleep_calls.append(seconds)

    call_count = 0

    async def mock_get_status(ticket_id: int):
        nonlocal call_count
        call_count += 1
        if call_count == 1:
            return {"ReturnCode": "SUCCESS", "TicketId": ticket_id, "TranState": "PENDING"}
        return {"ReturnCode": "SUCCESS", "TicketId": ticket_id, "TranState": "OK"}

    client = make_client()

    with patch.object(client.reconciliation, "get_transaction_status", side_effect=mock_get_status):
        with patch("ecollect.utils.polling.asyncio.sleep", side_effect=mock_sleep):
            result = await client.reconciliation.reconciliate(300, timeout=600)

    # One sleep call for the 30s interval between poll 1 (PENDING) and poll 2 (OK)
    assert len(sleep_calls) == 1
    assert sleep_calls[0] == 30
    assert result["TranState"] == "OK"
