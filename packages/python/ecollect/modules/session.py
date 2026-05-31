"""Session management: create, cache, and auto-refresh session tokens."""
import time
import logging
from typing import Optional

from ecollect.config import EcollectConfig
from ecollect.exceptions import raise_for_return_code
from ecollect.utils.http import AsyncHttpClient, run_sync

logger = logging.getLogger(__name__)

_REFRESH_THRESHOLD = 300  # seconds — refresh if less than 5 min remains


class SessionModule:
    """Handles session token lifecycle for the ecollect API."""

    def __init__(self, config: EcollectConfig, http: AsyncHttpClient) -> None:
        self._config = config
        self._http = http
        self._token: Optional[str] = None
        self._expires_at: float = 0.0

    # ------------------------------------------------------------------
    # Async API
    # ------------------------------------------------------------------

    async def create(self) -> str:
        """Request a new session token from the API and cache it.

        Returns the new SessionToken string.
        """
        url = self._config.endpoint_url("getSessionToken")
        payload = {
            "EntityCode": self._config.ety_code,
            "ApiKey": self._config.api_key,
        }
        data = await self._http.post_with_retry(url, payload)
        raise_for_return_code(data.get("ReturnCode", ""), str(data))

        token: str = data["SessionToken"]
        lifetime: int = data.get("LifetimeSecs", 1800)
        self._token = token
        self._expires_at = time.monotonic() + lifetime
        logger.debug("New session token obtained, expires in %ds", lifetime)
        return token

    async def get_active(self) -> str:
        """Return a valid session token, refreshing automatically if needed.

        If the cached token has less than 300 seconds remaining (or does not
        exist), a new token is requested transparently.
        """
        remaining = self._expires_at - time.monotonic()
        if self._token is None or remaining < _REFRESH_THRESHOLD:
            logger.debug(
                "Session token missing or expiring soon (remaining=%.0fs); refreshing",
                max(remaining, 0),
            )
            await self.create()
        return self._token  # type: ignore[return-value]

    def invalidate(self) -> None:
        """Force invalidation of the cached token (e.g. after FAIL_APIEXPIREDSESSION)."""
        self._token = None
        self._expires_at = 0.0

    # ------------------------------------------------------------------
    # Sync wrappers
    # ------------------------------------------------------------------

    def create_sync(self) -> str:
        return run_sync(self.create())

    def get_active_sync(self) -> str:
        return run_sync(self.get_active())
