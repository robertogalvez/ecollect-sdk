"""Payment links module (Link de Pagos via PaymentSystem=10)."""
import logging
from typing import Any, Dict, Literal

from ecollect.config import EcollectConfig
from ecollect.exceptions import raise_for_return_code
from ecollect.modules.payments import _build_reference_array, _build_payment_info_array, _info_item, _AC
from ecollect.types import PaymentIntent
from ecollect.utils.http import AsyncHttpClient, run_sync
from ecollect.utils.validators import validate_payment_intent

logger = logging.getLogger(__name__)

_PAYMENT_LINK_SYSTEM = 10


class PaymentLinksModule:
    """Generate payment links for email, SMS, or QR delivery."""

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

    async def generate_payment_link(
        self,
        intent: PaymentIntent,
        method: Literal["email", "sms", "qr"] = "email",
    ) -> Dict[str, Any]:
        """Generate a payment link via ecollect (PaymentSystem=10).

        Args:
            intent: Payment intent describing the transaction.
            method: Delivery channel — 'email' (default), 'sms', or 'qr'.

        Returns:
            Raw API response dict containing eCollectUrl and LifetimeSecs.
        """
        validate_payment_intent(intent)

        session_token = await self._session.get_active()
        ety = intent.ety_code if intent.ety_code is not None else self._config.ety_code
        srv = intent.srv_code if intent.srv_code is not None else self._config.srv_code

        payment_info = _build_payment_info_array(intent)

        # Ensure PaymentSystem=10
        payment_info = [p for p in payment_info if p.get("AttributeCode") != _AC["PaymentSystem"]]
        payment_info.insert(0, _info_item(_AC["PaymentSystem"], "PaymentSystem", str(_PAYMENT_LINK_SYSTEM)))

        if method == "sms":
            if intent.customer.mobile_country_code:
                payment_info.append(
                    _info_item(_AC["MobileCountryCode"], "MobileCountryCode", intent.customer.mobile_country_code)
                )
            if intent.customer.phone:
                payment_info.append(
                    _info_item(_AC["MobileNumber"], "MobileNumber", intent.customer.phone)
                )
        elif method == "qr":
            # QR uses the same flow — LifetimeSecs can be added if needed
            pass
        else:  # email (default)
            # Usermail already included via _build_payment_info_array
            pass

        payload: Dict[str, Any] = {
            "EntityCode": ety,
            "SessionToken": session_token,
            "TransValue": intent.amount,
            "SrvCurrency": intent.currency,
            "ReferenceArray": _build_reference_array(intent),
            "PaymentSystem": _PAYMENT_LINK_SYSTEM,
            "LangCode": intent.lang_code,
            "PaymentInfoArray": payment_info,
            "RequestType": 0,
        }
        if srv is not None:
            payload["SrvCode"] = srv
        if intent.vat_value is not None:
            payload["TransVatValue"] = intent.vat_value
        if intent.url_redirect:
            payload["URLRedirect"] = intent.url_redirect
        if intent.url_response:
            payload["URLResponse"] = intent.url_response

        return await self._post("createTransactionPayment", payload)

    def generate_payment_link_sync(
        self,
        intent: PaymentIntent,
        method: Literal["email", "sms", "qr"] = "email",
    ) -> Dict[str, Any]:
        return run_sync(self.generate_payment_link(intent, method))
