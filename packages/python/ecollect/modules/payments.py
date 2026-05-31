"""Payment processing module."""
import logging
from typing import Any, Dict, List, Optional

from ecollect.config import EcollectConfig
from ecollect.exceptions import SessionExpiredError, raise_for_return_code
from ecollect.types import PaymentIntent
from ecollect.utils.http import AsyncHttpClient, run_sync
from ecollect.utils.validators import validate_payment_intent

logger = logging.getLogger(__name__)

# AttributeCode constants
_AC = {
    "CardNumber": 0,
    "TokenId": 1,
    "PaymentSystem": 2,
    "SecureCode": 3,
    "ExpirationDate": 4,
    "Installments": 5,
    "Usermail": 6,
    "MobileCountryCode": 7,
    "MobileNumber": 8,
    "FiCode": 9,
    "CardHolderName": 17,
    "CardHolderIdType": 18,
    "CardHolderId": 19,
    "AccountType": 22,
    "IPAddress": 23,
    "DeviceFingerPrint": 24,
    "OneTimePassword": 25,
    "MerchantTransactionId": 26,
    "UserType": 34,
    "LifetimeSecs": 35,
}


def _info_item(code: int, desc: str, value: str) -> Dict[str, Any]:
    return {"AttributeCode": code, "AttributeDesc": desc, "AttributeValue": str(value)}


def _build_reference_array(intent: PaymentIntent) -> List[str]:
    """Build ReferenceArray from a PaymentIntent following the documented order."""
    c = intent.customer
    return [
        c.document_type or "",
        c.document_number or "",
        intent.merchant_transaction_id or "",
        c.full_name or "",
        c.email or "",
        c.phone or "",
    ]


def _build_payment_info_array(intent: PaymentIntent) -> List[Dict[str, Any]]:
    """Build PaymentInfoArray from a PaymentIntent."""
    items: List[Dict[str, Any]] = []

    if intent.payment_system is not None:
        items.append(_info_item(_AC["PaymentSystem"], "PaymentSystem", str(intent.payment_system)))
    if intent.customer.email:
        items.append(_info_item(_AC["Usermail"], "Usermail", intent.customer.email))
    if intent.customer.document_type:
        items.append(_info_item(_AC["CardHolderIdType"], "CardHolderIdType", intent.customer.document_type))
    if intent.customer.document_number:
        items.append(_info_item(_AC["CardHolderId"], "CardHolderId", intent.customer.document_number))
    if intent.ip_address:
        items.append(_info_item(_AC["IPAddress"], "IPAddress", intent.ip_address))
    if intent.device_fingerprint:
        items.append(_info_item(_AC["DeviceFingerPrint"], "DeviceFingerPrint", intent.device_fingerprint))
    if intent.merchant_transaction_id:
        items.append(_info_item(_AC["MerchantTransactionId"], "MerchantTransactionId", intent.merchant_transaction_id))
    if intent.user_type is not None:
        items.append(_info_item(_AC["UserType"], "UserType", str(intent.user_type)))
    if intent.account_type is not None:
        items.append(_info_item(_AC["AccountType"], "AccountType", str(intent.account_type)))
    if intent.one_time_password:
        items.append(_info_item(_AC["OneTimePassword"], "OneTimePassword", intent.one_time_password))

    # Append any extra items provided by the caller
    items.extend(intent.extra_payment_info)
    return items


def _build_token_info_array(intent: PaymentIntent) -> List[Dict[str, Any]]:
    """Build TokenInfoArray from a PaymentIntent."""
    items: List[Dict[str, Any]] = []
    if intent.token_id:
        items.append(_info_item(_AC["TokenId"], "TokenId", intent.token_id))
    if intent.payment_system is not None:
        items.append(_info_item(_AC["PaymentSystem"], "PaymentSystem", str(intent.payment_system)))
    if intent.fi_code:
        items.append(_info_item(_AC["FiCode"], "FiCode", intent.fi_code))
    if intent.secure_code:
        items.append(_info_item(_AC["SecureCode"], "SecureCode", intent.secure_code))
    if intent.installments is not None:
        items.append(_info_item(_AC["Installments"], "Installments", str(intent.installments)))
    if intent.customer.email:
        items.append(_info_item(_AC["Usermail"], "Usermail", intent.customer.email))
    if intent.customer.document_number:
        items.append(_info_item(_AC["CardHolderId"], "CardHolderId", intent.customer.document_number))
    return items


class PaymentsModule:
    """Handles payment creation, pre-authorization, capture, void, and hosted checkout."""

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
        """Post to endpoint, auto-refreshing session on FAIL_APIEXPIREDSESSION."""
        url = self._config.endpoint_url(endpoint)
        data = await self._http.post_with_retry(url, payload)
        return_code = data.get("ReturnCode", "")
        if return_code == "FAIL_APIEXPIREDSESSION":
            logger.info("Session expired; refreshing and retrying once")
            self._session.invalidate()
            payload["SessionToken"] = await self._session.get_active()
            data = await self._http.post_with_retry(url, payload)
        raise_for_return_code(data.get("ReturnCode", ""), str(data))
        return data

    def _resolve_codes(self, intent: PaymentIntent) -> tuple:
        ety = intent.ety_code if intent.ety_code is not None else self._config.ety_code
        srv = intent.srv_code if intent.srv_code is not None else self._config.srv_code
        return ety, srv

    async def _build_payload(self, intent: PaymentIntent, request_type: Any = None) -> Dict[str, Any]:
        ety_code, srv_code = self._resolve_codes(intent)
        session_token = await self._session.get_active()

        payload: Dict[str, Any] = {
            "EntityCode": ety_code,
            "SessionToken": session_token,
            "TransValue": intent.amount,
            "SrvCurrency": intent.currency,
            "ReferenceArray": _build_reference_array(intent),
            "LangCode": intent.lang_code,
        }
        if srv_code is not None:
            payload["SrvCode"] = srv_code
        if intent.vat_value is not None:
            payload["TransVatValue"] = intent.vat_value
        if intent.url_redirect:
            payload["URLRedirect"] = intent.url_redirect
        if intent.url_response:
            payload["URLResponse"] = intent.url_response
        if intent.payment_system is not None:
            payload["PaymentSystem"] = intent.payment_system
        if intent.fi_code:
            payload["FICode"] = intent.fi_code
        if intent.invoice:
            payload["Invoice"] = intent.invoice
        if intent.invoice_due_date:
            payload["InvoiceDueDate"] = intent.invoice_due_date
        if intent.policy_code:
            payload["PolicyCode"] = intent.policy_code

        rt = request_type if request_type is not None else (intent.request_type if intent.request_type is not None else 0)
        payload["RequestType"] = rt

        payment_info = _build_payment_info_array(intent)
        if payment_info:
            payload["PaymentInfoArray"] = payment_info

        token_info = _build_token_info_array(intent)
        if token_info:
            payload["TokenInfoArray"] = token_info

        if intent.subservices:
            payload["SubservicesArray"] = intent.subservices

        return payload

    # ------------------------------------------------------------------
    # Async API
    # ------------------------------------------------------------------

    async def process(self, intent: PaymentIntent) -> Dict[str, Any]:
        """Process an immediate payment (RequestType=0)."""
        validate_payment_intent(intent)
        payload = await self._build_payload(intent, request_type=0)
        return await self._post("createTransactionPayment", payload)

    async def pre_authorize(self, intent: PaymentIntent) -> Dict[str, Any]:
        """Send a pre-authorization request (RequestType=1)."""
        validate_payment_intent(intent)
        payload = await self._build_payload(intent, request_type=1)
        return await self._post("createTransactionPayment", payload)

    async def capture(self, ticket_id: int, amount: Optional[float] = None, intent: Optional[PaymentIntent] = None) -> Dict[str, Any]:
        """Capture / post a pre-authorized transaction (RequestType=TicketId)."""
        session_token = await self._session.get_active()
        payload: Dict[str, Any] = {
            "EntityCode": self._config.ety_code,
            "SessionToken": session_token,
            "RequestType": ticket_id,  # positive TicketId = post
        }
        if amount is not None:
            payload["TransValue"] = amount
        if intent is not None:
            payload["SrvCurrency"] = intent.currency
            ety, srv = self._resolve_codes(intent)
            payload["EntityCode"] = ety
            if srv:
                payload["SrvCode"] = srv
        return await self._post("createTransactionPayment", payload)

    async def void_payment(self, ticket_id: int) -> Dict[str, Any]:
        """Void / reverse a pre-authorization (RequestType=-TicketId)."""
        session_token = await self._session.get_active()
        payload: Dict[str, Any] = {
            "EntityCode": self._config.ety_code,
            "SessionToken": session_token,
            "RequestType": -ticket_id,  # negative = anular
        }
        return await self._post("createTransactionPayment", payload)

    async def hosted_checkout(self, intent: PaymentIntent) -> Dict[str, Any]:
        """Create a hosted checkout — returns eCollectUrl for user redirection."""
        validate_payment_intent(intent)
        payload = await self._build_payload(intent, request_type=0)
        return await self._post("createTransactionPayment", payload)

    # ------------------------------------------------------------------
    # Sync wrappers
    # ------------------------------------------------------------------

    def process_sync(self, intent: PaymentIntent) -> Dict[str, Any]:
        return run_sync(self.process(intent))

    def pre_authorize_sync(self, intent: PaymentIntent) -> Dict[str, Any]:
        return run_sync(self.pre_authorize(intent))

    def capture_sync(self, ticket_id: int, amount: Optional[float] = None, intent: Optional[PaymentIntent] = None) -> Dict[str, Any]:
        return run_sync(self.capture(ticket_id, amount, intent))

    def void_payment_sync(self, ticket_id: int) -> Dict[str, Any]:
        return run_sync(self.void_payment(ticket_id))

    def hosted_checkout_sync(self, intent: PaymentIntent) -> Dict[str, Any]:
        return run_sync(self.hosted_checkout(intent))
