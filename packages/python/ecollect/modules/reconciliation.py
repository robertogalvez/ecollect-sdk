"""Reconciliation module: transaction status queries and polling-based resolution."""
import logging
from typing import Any, Callable, Dict, Optional

from ecollect.config import EcollectConfig
from ecollect.exceptions import raise_for_return_code
from ecollect.utils.http import AsyncHttpClient, run_sync
from ecollect.utils.polling import PollingManager

logger = logging.getLogger(__name__)


class ReconciliationModule:
    """Query transaction status and reconcile pending transactions."""

    def __init__(
        self,
        config: EcollectConfig,
        http: AsyncHttpClient,
        session: "SessionModule",  # type: ignore[name-defined]
    ) -> None:
        self._config = config
        self._http = http
        self._session = session
        self._polling = PollingManager()

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

    async def get_transaction_status(
        self,
        ticket_id: int,
        merchant_transaction_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Query the current state of a transaction.

        Args:
            ticket_id: ecollect TicketId.
            merchant_transaction_id: Optional fallback if TicketId is unavailable.
        """
        session_token = await self._session.get_active()
        payload: Dict[str, Any] = {
            "EntityCode": self._config.ety_code,
            "SessionToken": session_token,
            "TicketId": ticket_id,
        }
        if merchant_transaction_id:
            payload["PaymentInfoArray"] = [
                {
                    "AttributeCode": 26,
                    "AttributeDesc": "MerchantTransactionId",
                    "AttributeValue": merchant_transaction_id,
                }
            ]
        return await self._post("getTransactionInformation", payload)

    async def reconciliate(
        self,
        ticket_id: int,
        on_complete: Optional[Callable[[Dict[str, Any]], None]] = None,
        timeout: int = 600,
    ) -> Dict[str, Any]:
        """Poll transaction status until a terminal state is reached.

        Args:
            ticket_id: ecollect TicketId to reconcile.
            on_complete: Optional callback called with the final status.
            timeout: Seconds before raising PollingTimeoutError.

        Returns:
            The final transaction status dict.
        """
        result: Dict[str, Any] = {}

        def _on_complete(status: Dict[str, Any]) -> None:
            nonlocal result
            result = status
            if on_complete:
                on_complete(status)

        await self._polling.start_polling(
            ticket_id=ticket_id,
            get_status=self.get_transaction_status,
            on_complete=_on_complete,
            timeout=timeout,
        )
        return result

    # ------------------------------------------------------------------
    # Sync wrappers
    # ------------------------------------------------------------------

    def get_transaction_status_sync(
        self,
        ticket_id: int,
        merchant_transaction_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        return run_sync(self.get_transaction_status(ticket_id, merchant_transaction_id))

    def reconciliate_sync(
        self,
        ticket_id: int,
        on_complete: Optional[Callable[[Dict[str, Any]], None]] = None,
        timeout: int = 600,
    ) -> Dict[str, Any]:
        return run_sync(self.reconciliate(ticket_id, on_complete, timeout))
