"""Tests for token management module."""
import pytest
import respx
import httpx

from ecollect import EcollectClient
from ecollect.exceptions import TokenNotFoundError

TEST_BASE = "https://test1.e-collect.com/app_express/api/"
SESSION_URL = TEST_BASE + "getSessionToken"
TOKEN_URL = TEST_BASE + "tokenCommand"
QUERY_TOKEN_URL = TEST_BASE + "queryToken"


def make_client() -> EcollectClient:
    return EcollectClient(api_key="key", ety_code=100, environment="test")


def _session_response():
    return httpx.Response(
        200,
        json={"ReturnCode": "SUCCESS", "SessionToken": "session-tok", "LifetimeSecs": 1800},
    )


@pytest.mark.asyncio
async def test_save_token():
    """save() sends SAVE command and returns token info."""
    with respx.mock:
        respx.post(SESSION_URL).mock(return_value=_session_response())
        respx.post(TOKEN_URL).mock(
            return_value=httpx.Response(
                200,
                json={
                    "ReturnCode": "SUCCESS",
                    "TokenInfoArray": [
                        {"AttributeCode": 1, "AttributeDesc": "TokenId", "AttributeValue": "tok-001"}
                    ],
                },
            )
        )
        client = make_client()
        token_info = [{"AttributeCode": 0, "AttributeDesc": "CardNumber", "AttributeValue": "4111111111111111"}]
        result = await client.tokens.save(token_info)
        assert result["ReturnCode"] == "SUCCESS"


@pytest.mark.asyncio
async def test_list_saved_cards():
    """list_saved() queries tokenized cards and returns SavedCard objects."""
    with respx.mock:
        respx.post(SESSION_URL).mock(return_value=_session_response())
        respx.post(QUERY_TOKEN_URL).mock(
            return_value=httpx.Response(
                200,
                json={
                    "ReturnCode": "SUCCESS",
                    "TokenArray": [
                        {
                            "TokenInfoArray": [
                                {"AttributeCode": 1, "AttributeDesc": "TokenId", "AttributeValue": "tok-111"},
                                {"AttributeCode": 12, "AttributeDesc": "MaskedCard", "AttributeValue": "VISA ****1111"},
                                {"AttributeCode": 11, "AttributeDesc": "Last4", "AttributeValue": "1111"},
                            ]
                        }
                    ],
                },
            )
        )
        client = make_client()
        cards = await client.tokens.list_saved("user@test.com", "12345")
        assert len(cards) == 1
        assert cards[0].token_id == "tok-111"
        assert cards[0].last4 == "1111"


@pytest.mark.asyncio
async def test_token_not_found_error():
    """FAIL_TOKENNOTFOUND raises TokenNotFoundError."""
    with respx.mock:
        respx.post(SESSION_URL).mock(return_value=_session_response())
        respx.post(TOKEN_URL).mock(
            return_value=httpx.Response(200, json={"ReturnCode": "FAIL_TOKENNOTFOUND"})
        )
        client = make_client()
        with pytest.raises(TokenNotFoundError):
            await client.tokens.delete("nonexistent-token")
