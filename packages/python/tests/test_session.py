"""Tests for session creation, caching, and auto-refresh."""
import time
import pytest
import respx
import httpx

from ecollect import EcollectClient
from ecollect.exceptions import InvalidConfigError


TEST_BASE = "https://test1.e-collect.com/app_express/api/"
SESSION_URL = TEST_BASE + "getSessionToken"


def make_client() -> EcollectClient:
    return EcollectClient(api_key="test-key", ety_code=999, environment="test")


@pytest.mark.asyncio
async def test_session_create_success():
    """Session.create() returns the token and caches it."""
    with respx.mock:
        respx.post(SESSION_URL).mock(
            return_value=httpx.Response(
                200,
                json={"ReturnCode": "SUCCESS", "SessionToken": "tok-abc", "LifetimeSecs": 1800},
            )
        )
        client = make_client()
        token = await client.session.create()
        assert token == "tok-abc"
        assert client.session._token == "tok-abc"


@pytest.mark.asyncio
async def test_session_cached_on_second_call():
    """get_active() returns the cached token without a new API call."""
    with respx.mock:
        route = respx.post(SESSION_URL).mock(
            return_value=httpx.Response(
                200,
                json={"ReturnCode": "SUCCESS", "SessionToken": "tok-xyz", "LifetimeSecs": 1800},
            )
        )
        client = make_client()
        t1 = await client.session.get_active()
        t2 = await client.session.get_active()
        assert t1 == t2 == "tok-xyz"
        assert route.call_count == 1  # only one API call


@pytest.mark.asyncio
async def test_session_auto_refresh_when_expiring_soon():
    """get_active() auto-refreshes when < 300s remaining."""
    with respx.mock:
        respx.post(SESSION_URL).mock(
            return_value=httpx.Response(
                200,
                json={"ReturnCode": "SUCCESS", "SessionToken": "tok-new", "LifetimeSecs": 1800},
            )
        )
        client = make_client()
        # Simulate an existing token that will expire in 100 seconds
        client.session._token = "tok-old"
        client.session._expires_at = time.monotonic() + 100  # < 300s threshold

        token = await client.session.get_active()
        assert token == "tok-new"


@pytest.mark.asyncio
async def test_session_error_maps_to_exception():
    """FAIL_INVALIDENTITYCODE raises InvalidConfigError."""
    with respx.mock:
        respx.post(SESSION_URL).mock(
            return_value=httpx.Response(
                200,
                json={"ReturnCode": "FAIL_INVALIDENTITYCODE"},
            )
        )
        client = make_client()
        with pytest.raises(InvalidConfigError):
            await client.session.create()
