"""Async polling manager for transaction state resolution."""
import asyncio
import logging
from typing import Any, Callable, Optional

from ecollect.exceptions import PollingTimeoutError

logger = logging.getLogger(__name__)

_TERMINAL_STATES = {"OK", "NOT_AUTHORIZED", "EXPIRED", "FAILED"}
_BANK_PENDING_INTERVAL = 30  # seconds
_CREATED_INTERVAL = 300  # seconds


class PollingManager:
    """Poll getTransactionInformation until a terminal state is reached."""

    async def start_polling(
        self,
        ticket_id: int,
        get_status: Callable[[int], Any],
        on_complete: Callable[[Any], None],
        timeout: int = 600,
    ) -> None:
        """Poll transaction status until terminal state or timeout.

        Args:
            ticket_id: ecollect TicketId to poll.
            get_status: async callable that accepts ticket_id and returns
                        a dict with at minimum a 'TranState' key.
            on_complete: callback invoked with the final status dict.
            timeout: maximum polling duration in seconds (default 600s / 10 min).
        """
        elapsed = 0.0
        while elapsed < timeout:
            status = await get_status(ticket_id)
            tran_state = status.get("TranState", "")

            if tran_state in _TERMINAL_STATES:
                on_complete(status)
                return

            if tran_state in ("BANK", "PENDING"):
                interval = _BANK_PENDING_INTERVAL
            elif tran_state == "CREATED":
                interval = _CREATED_INTERVAL
            else:
                interval = _BANK_PENDING_INTERVAL

            remaining = timeout - elapsed
            wait = min(interval, remaining)
            if wait <= 0:
                break

            logger.debug(
                "TicketId=%s state=%s, polling again in %ds", ticket_id, tran_state, wait
            )
            await asyncio.sleep(wait)
            elapsed += wait

        raise PollingTimeoutError(
            f"Polling timed out after {timeout}s for TicketId={ticket_id}"
        )
