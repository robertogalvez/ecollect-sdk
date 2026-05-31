"""Token management module (tokenCommand + queryToken)."""
import logging
from typing import Any, Dict, List, Optional

from ecollect.config import EcollectConfig
from ecollect.exceptions import raise_for_return_code
from ecollect.types import SavedCard
from ecollect.utils.http import AsyncHttpClient, run_sync

logger = logging.getLogger(__name__)


def _info_item(code: int, desc: str, value: str) -> Dict[str, Any]:
    return {"AttributeCode": code, "AttributeDesc": desc, "AttributeValue": str(value)}


def _parse_saved_card(token_info_array: List[Dict[str, Any]]) -> SavedCard:
    """Parse a TokenInfoArray list into a SavedCard object."""
    attrs: Dict[int, str] = {
        item["AttributeCode"]: item.get("AttributeValue", "")
        for item in token_info_array
    }
    return SavedCard(
        token_id=attrs.get(1, ""),
        masked_card=attrs.get(12),
        last4=attrs.get(11),
        fi_code=attrs.get(9),
        fi_name=attrs.get(10),
        payment_system=attrs.get(2),
        brand_image_url=attrs.get(13),
        customer_id=attrs.get(36),  # CustomerId attr code
    )


class TokensModule:
    """Handles tokenisation commands and saved card queries."""

    def __init__(
        self,
        config: EcollectConfig,
        http: AsyncHttpClient,
        session: "SessionModule",  # type: ignore[name-defined]
    ) -> None:
        self._config = config
        self._http = http
        self._session = session

    async def _post(self, endpoint: str, payload: Dict[str, Any]) -> Dict[str, Any]:
        url = self._config.endpoint_url(endpoint)
        data = await self._http.post_with_retry(url, payload)
        return_code = data.get("ReturnCode", "")
        if return_code == "FAIL_APIEXPIREDSESSION":
            self._session.invalidate()
            payload["SessionToken"] = await self._session.get_active()
            data = await self._http.post_with_retry(url, payload)
        raise_for_return_code(data.get("ReturnCode", ""), str(data))
        return data

    async def _token_command(self, command: str, token_info: List[Dict[str, Any]]) -> Dict[str, Any]:
        session_token = await self._session.get_active()
        payload = {
            "EntityCode": self._config.ety_code,
            "SessionToken": session_token,
            "Command": command,
            "TokenInfoArray": token_info,
        }
        return await self._post("tokenCommand", payload)

    # ------------------------------------------------------------------
    # Async API
    # ------------------------------------------------------------------

    async def save(self, token_info: List[Dict[str, Any]]) -> Dict[str, Any]:
        """SAVE command — tokenize a card for future use."""
        return await self._token_command("SAVE", token_info)

    async def get_temporary(self, token_info: List[Dict[str, Any]]) -> Dict[str, Any]:
        """GET command — obtain a temporary token (single-use, no persistence)."""
        return await self._token_command("GET", token_info)

    async def hold(self, token_info: List[Dict[str, Any]]) -> Dict[str, Any]:
        """HOLD command — obtain a reserved token for pre-authorization."""
        return await self._token_command("HOLD", token_info)

    async def list_saved(self, usermail: str, card_holder_id: str) -> List[SavedCard]:
        """Query all saved cards for a user via queryToken."""
        session_token = await self._session.get_active()
        payload = {
            "EntityCode": self._config.ety_code,
            "SessionToken": session_token,
            "TokenInfoArray": [
                _info_item(6, "Usermail", usermail),
                _info_item(19, "CardHolderId", card_holder_id),
            ],
        }
        data = await self._post("queryToken", payload)
        token_array: List[Dict[str, Any]] = data.get("TokenArray", [])
        return [_parse_saved_card(t.get("TokenInfoArray", [])) for t in token_array]

    async def delete(self, token_id: str, card_holder_id: Optional[str] = None) -> Dict[str, Any]:
        """REMOVE command — delete a saved card token."""
        token_info = [_info_item(1, "TokenId", token_id)]
        if card_holder_id:
            token_info.append(_info_item(19, "CardHolderId", card_holder_id))
        return await self._token_command("REMOVE", token_info)

    async def update(self, token_id: str, expiration_date: str) -> Dict[str, Any]:
        """UPDATE command — update the expiration date of a saved card."""
        token_info = [
            _info_item(1, "TokenId", token_id),
            _info_item(4, "ExpirationDate", expiration_date),
        ]
        return await self._token_command("UPDATE", token_info)

    # ------------------------------------------------------------------
    # Sync wrappers
    # ------------------------------------------------------------------

    def save_sync(self, token_info: List[Dict[str, Any]]) -> Dict[str, Any]:
        return run_sync(self.save(token_info))

    def get_temporary_sync(self, token_info: List[Dict[str, Any]]) -> Dict[str, Any]:
        return run_sync(self.get_temporary(token_info))

    def hold_sync(self, token_info: List[Dict[str, Any]]) -> Dict[str, Any]:
        return run_sync(self.hold(token_info))

    def list_saved_sync(self, usermail: str, card_holder_id: str) -> List[SavedCard]:
        return run_sync(self.list_saved(usermail, card_holder_id))

    def delete_sync(self, token_id: str, card_holder_id: Optional[str] = None) -> Dict[str, Any]:
        return run_sync(self.delete(token_id, card_holder_id))

    def update_sync(self, token_id: str, expiration_date: str) -> Dict[str, Any]:
        return run_sync(self.update(token_id, expiration_date))
