"""Payment systems module (getPaymentSystem)."""
import logging
from typing import Any, Dict, List

from ecollect.config import EcollectConfig
from ecollect.exceptions import raise_for_return_code
from ecollect.utils.http import AsyncHttpClient, run_sync

logger = logging.getLogger(__name__)


class PaymentSystemsModule:
    """Query available payment methods for the merchant."""

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

    async def get_payment_systems(self) -> List[Dict[str, Any]]:
        """Return the list of payment systems enabled for this merchant."""
        session_token = await self._session.get_active()
        payload = {
            "EntityCode": self._config.ety_code,
            "SessionToken": session_token,
        }
        data = await self._post("getPaymentSystem", payload)
        return data.get("PaymentSystemArray", [])

    def get_payment_systems_sync(self) -> List[Dict[str, Any]]:
        return run_sync(self.get_payment_systems())
