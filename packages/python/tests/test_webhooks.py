"""Tests for webhook verification."""
import json
import pytest
import respx
import httpx

from ecollect import EcollectClient
from ecollect.exceptions import WebhookValidationError
from ecollect.utils.crypto import compute_hmac_sha256

TEST_BASE = "https://test1.e-collect.com/app_express/api/"
SESSION_URL = TEST_BASE + "getSessionToken"
VERIFY_URL = TEST_BASE + "verifySessionToken"


def make_client() -> EcollectClient:
    return EcollectClient(api_key="key", ety_code=100, environment="test")


def _session_response():
    return httpx.Response(
        200,
        json={"ReturnCode": "SUCCESS", "SessionToken": "session-tok", "LifetimeSecs": 1800},
    )


class TestVerifyWebhookSignature:
    def test_valid_signature_passes(self):
        client = make_client()
        secret = "my-webhook-secret"
        payload = b'{"TicketId":123,"TranState":"OK"}'
        sig = compute_hmac_sha256(payload, secret)
        # Should not raise
        assert client.webhooks.verify_webhook_signature(payload, secret, sig) is True

    def test_invalid_signature_raises(self):
        client = make_client()
        secret = "my-webhook-secret"
        payload = b'{"TicketId":123}'
        with pytest.raises(WebhookValidationError):
            client.webhooks.verify_webhook_signature(payload, secret, "bad-sig")

    def test_dict_payload_works(self):
        client = make_client()
        secret = "secret"
        payload_dict = {"TicketId": 1, "TranState": "OK"}
        # Compute sig from canonical JSON
        raw = json.dumps(payload_dict, separators=(",", ":"), sort_keys=True).encode()
        sig = compute_hmac_sha256(raw, secret)
        assert client.webhooks.verify_webhook_signature(payload_dict, secret, sig) is True


class TestConfirmWebhook:
    @pytest.mark.asyncio
    async def test_confirm_webhook_success(self):
        with respx.mock:
            respx.post(SESSION_URL).mock(return_value=_session_response())
            respx.post(VERIFY_URL).mock(
                return_value=httpx.Response(200, json={"ReturnCode": "SUCCESS"})
            )
            client = make_client()
            result = await client.webhooks.confirm_webhook("incoming-session-tok", ticket_id=9999)
            assert result is True

    @pytest.mark.asyncio
    async def test_confirm_webhook_fail_session_not_found(self):
        with respx.mock:
            respx.post(SESSION_URL).mock(return_value=_session_response())
            respx.post(VERIFY_URL).mock(
                return_value=httpx.Response(200, json={"ReturnCode": "FAIL_SESSIONNOTFOUND"})
            )
            client = make_client()
            with pytest.raises(WebhookValidationError):
                await client.webhooks.confirm_webhook("bad-token")

    @pytest.mark.asyncio
    async def test_confirm_webhook_fail_ticket_mismatch(self):
        with respx.mock:
            respx.post(SESSION_URL).mock(return_value=_session_response())
            respx.post(VERIFY_URL).mock(
                return_value=httpx.Response(200, json={"ReturnCode": "FAIL_TICKETIDNOTMATCH"})
            )
            client = make_client()
            with pytest.raises(WebhookValidationError):
                await client.webhooks.confirm_webhook("session-tok", ticket_id=1)
