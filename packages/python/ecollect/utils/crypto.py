"""HMAC-SHA256 helpers for webhook signature verification."""
import hashlib
import hmac
import json
from typing import Any, Dict, Union


def compute_hmac_sha256(payload: Union[str, bytes], secret: Union[str, bytes]) -> str:
    """Compute HMAC-SHA256 of payload using secret key.

    Returns lowercase hex digest.
    """
    if isinstance(payload, str):
        payload = payload.encode("utf-8")
    if isinstance(secret, str):
        secret = secret.encode("utf-8")
    return hmac.new(secret, payload, hashlib.sha256).hexdigest()


def verify_hmac_sha256(
    payload: Union[str, bytes],
    secret: Union[str, bytes],
    expected_signature: str,
) -> bool:
    """Verify an HMAC-SHA256 signature using constant-time comparison."""
    computed = compute_hmac_sha256(payload, secret)
    return hmac.compare_digest(computed, expected_signature.lower())


def payload_to_bytes(payload: Union[str, bytes, Dict[str, Any]]) -> bytes:
    """Normalise a payload to bytes for signing."""
    if isinstance(payload, bytes):
        return payload
    if isinstance(payload, dict):
        return json.dumps(payload, separators=(",", ":"), sort_keys=True).encode("utf-8")
    return payload.encode("utf-8")
