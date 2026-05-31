"""Customer management module (getCustomerId)."""
import logging
from typing import Any, Dict, Optional

from ecollect.config import EcollectConfig
from ecollect.exceptions import raise_for_return_code
from ecollect.utils.http import AsyncHttpClient, run_sync

logger = logging.getLogger(__name__)


def _info_item(code: int, desc: str, value: str) -> Dict[str, Any]:
    return {"AttributeCode": code, "AttributeDesc": desc, "AttributeValue": str(value)}


class CustomersModule:
    """Handles customer identity management for tokenisation."""

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

    # ------------------------------------------------------------------
    # Async API
    # ------------------------------------------------------------------

    async def get_or_create_customer_id(
        self,
        email: str,
        card_holder_id: str,
        card_holder_name: str,
        card_holder_id_type: str,
        mobile_country_code: str,
        mobile_number: str,
    ) -> str:
        """Get or create a persistent CustomerId for a customer.

        Returns the CustomerId string from ecollect.
        """
        session_token = await self._session.get_active()
        payload: Dict[str, Any] = {
            "EntityCode": self._config.ety_code,
            "SessionToken": session_token,
            "CustomerInfoArray": [
                _info_item(6, "Usermail", email),
                _info_item(19, "CardHolderId", card_holder_id),
                _info_item(17, "CardHolderName", card_holder_name),
                _info_item(18, "CardHolderIdType", card_holder_id_type),
                _info_item(7, "MobileCountryCode", mobile_country_code),
                _info_item(8, "MobileNumber", mobile_number),
            ],
        }
        data = await self._post("getCustomerId", payload)
        # CustomerId is returned in CustomerInfoArray
        for item in data.get("CustomerInfoArray", []):
            if item.get("AttributeDesc", "").lower() == "customerid":
                return item["AttributeValue"]
        # Fallback: look for AttributeCode 36 (CustomerId)
        for item in data.get("CustomerInfoArray", []):
            if item.get("AttributeCode") == 36:
                return item["AttributeValue"]
        return data.get("CustomerId", "")

    async def update_customer_info(
        self,
        customer_id: str,
        email: Optional[str] = None,
        card_holder_name: Optional[str] = None,
        card_holder_id_type: Optional[str] = None,
        mobile_country_code: Optional[str] = None,
        mobile_number: Optional[str] = None,
    ) -> str:
        """Update an existing customer's information.

        Returns the CustomerId (unchanged).
        """
        session_token = await self._session.get_active()
        info_array = [_info_item(36, "CustomerId", customer_id)]
        if email:
            info_array.append(_info_item(6, "Usermail", email))
        if card_holder_name:
            info_array.append(_info_item(17, "CardHolderName", card_holder_name))
        if card_holder_id_type:
            info_array.append(_info_item(18, "CardHolderIdType", card_holder_id_type))
        if mobile_country_code:
            info_array.append(_info_item(7, "MobileCountryCode", mobile_country_code))
        if mobile_number:
            info_array.append(_info_item(8, "MobileNumber", mobile_number))

        payload: Dict[str, Any] = {
            "EntityCode": self._config.ety_code,
            "SessionToken": session_token,
            "CustomerInfoArray": info_array,
        }
        data = await self._post("getCustomerId", payload)
        return customer_id

    # ------------------------------------------------------------------
    # Sync wrappers
    # ------------------------------------------------------------------

    def get_or_create_customer_id_sync(self, *args, **kwargs) -> str:
        return run_sync(self.get_or_create_customer_id(*args, **kwargs))

    def update_customer_info_sync(self, *args, **kwargs) -> str:
        return run_sync(self.update_customer_info(*args, **kwargs))
