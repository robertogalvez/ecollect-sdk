"""httpx-based async (and sync wrapper) HTTP client with retry logic."""
import asyncio
import logging
from typing import Any, Dict, Optional

import httpx

from ecollect.exceptions import NetworkRetryableError, raise_for_return_code

logger = logging.getLogger(__name__)

_MAX_RETRIES = 3


class AsyncHttpClient:
    """Thin async HTTP client wrapping httpx.AsyncClient."""

    def __init__(self, timeout: float = 30.0) -> None:
        self._timeout = timeout
        self._client: Optional[httpx.AsyncClient] = None

    async def _get_client(self) -> httpx.AsyncClient:
        if self._client is None or self._client.is_closed:
            self._client = httpx.AsyncClient(timeout=self._timeout)
        return self._client

    async def post(self, url: str, payload: Dict[str, Any]) -> Dict[str, Any]:
        """POST JSON payload to url, return parsed JSON response."""
        client = await self._get_client()
        logger.debug("POST %s payload=%s", url, payload)
        response = await client.post(url, json=payload)
        response.raise_for_status()
        data: Dict[str, Any] = response.json()
        logger.debug("Response: %s", data)
        return data

    async def post_with_retry(self, url: str, payload: Dict[str, Any]) -> Dict[str, Any]:
        """POST with automatic retry on NetworkRetryableError (FAIL_SYSTEM).

        Uses exponential backoff: sleep(2 ** attempt) seconds.
        """
        last_exc: Optional[Exception] = None
        for attempt in range(_MAX_RETRIES):
            try:
                data = await self.post(url, payload)
                return_code = data.get("ReturnCode", "")
                if return_code == "FAIL_SYSTEM":
                    raise NetworkRetryableError(return_code, return_code=return_code)
                return data
            except NetworkRetryableError as exc:
                last_exc = exc
                if attempt < _MAX_RETRIES - 1:
                    wait = 2 ** attempt
                    logger.warning(
                        "FAIL_SYSTEM on attempt %d/%d, retrying in %ds",
                        attempt + 1,
                        _MAX_RETRIES,
                        wait,
                    )
                    await asyncio.sleep(wait)
            except httpx.HTTPError as exc:
                raise NetworkRetryableError(str(exc)) from exc
        raise last_exc  # type: ignore[misc]

    async def close(self) -> None:
        if self._client and not self._client.is_closed:
            await self._client.aclose()


def run_sync(coro: Any) -> Any:
    """Run an async coroutine synchronously."""
    try:
        loop = asyncio.get_event_loop()
        if loop.is_running():
            # In an already-running loop (e.g. Jupyter), we cannot call loop.run_until_complete
            import concurrent.futures

            with concurrent.futures.ThreadPoolExecutor(max_workers=1) as pool:
                future = pool.submit(asyncio.run, coro)
                return future.result()
        return loop.run_until_complete(coro)
    except RuntimeError:
        return asyncio.run(coro)
