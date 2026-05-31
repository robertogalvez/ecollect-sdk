"""Webhook verification and confirmation module."""
import logging
from typing import Any, Dict, Optional, Union

from ecollect.config import EcollectConfig
from ecollect.exceptions import WebhookValidationError, raise_for_return_code
from ecollect.utils.crypto import compute_hmac_sha256, payload_to_bytes, verify_hmac_sha256
from ecollect.utils.http import AsyncHttpClient, run_sync

logger = logging.getLogger(__name__)


class WebhooksModule:
    """Handles webhook signature verification and session token confirmation."""

    def __init__(
        self,
        config: EcollectConfig,
        http: AsyncHttpClient,
        session: "SessionModule",  # type: ignore[name-defined]
    ) -> None:
        self._config = config
        self._http = http
        self._session = session

    def verify_webhook_signature(
        self,
        payload: Union[str, bytes, Dict[str, Any]],
        secret: str,
        signature: str,
    ) -> bool:
        """Verify an HMAC-SHA256 webhook signature.

        Args:
            payload: Raw request body (str/bytes) or dict that will be
                     serialised to canonical JSON.
            secret: Shared secret known to both ecollect and the merchant.
            signature: Signature provided in the webhook request header.

        Returns:
            True if the signature is valid.

        Raises:
            WebhookValidationError: If the signature does not match.
        """
        raw = payload_to_bytes(payload)
        if not verify_hmac_sha256(raw, secret, signature):
            raise WebhookValidationError("Webhook HMAC-SHA256 signature mismatch")
        return True

    async def confirm_webhook(
        self,
        session_token_to_verify: str,
        ticket_id: Optional[int] = None,
    ) -> bool:
        """Confirm webhook authenticity via the verifySessionToken API.

        Args:
            session_token_to_verify: The SessionToken field received in the webhook payload.
            ticket_id: Optional TicketId to verify against the token.

        Returns:
            True if ecollect confirms the token is valid.

        Raises:
            WebhookValidationError: If verification fails.
        """
        current_token = await self._session.get_active()
        url = self._config.endpoint_url("verifySessionToken")
        payload: Dict[str, Any] = {
            "EntityCode": self._config.ety_code,
            "SessionToken": current_token,
            "SessionTokenToVerify": session_token_to_verify,
        }
        if ticket_id is not None:
            payload["TicketIdToVerify"] = ticket_id

        data = await self._http.post_with_retry(url, payload)
        return_code = data.get("ReturnCode", "")
        raise_for_return_code(return_code, str(data))
        return True

    # ------------------------------------------------------------------
    # Sync wrappers
    # ------------------------------------------------------------------

    def confirm_webhook_sync(
        self,
        session_token_to_verify: str,
        ticket_id: Optional[int] = None,
    ) -> bool:
        return run_sync(self.confirm_webhook(session_token_to_verify, ticket_id))
