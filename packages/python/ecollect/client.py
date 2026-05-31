"""Main EcollectClient entry point."""
from ecollect.config import EcollectConfig
from ecollect.modules.customers import CustomersModule
from ecollect.modules.payment_links import PaymentLinksModule
from ecollect.modules.payment_systems import PaymentSystemsModule
from ecollect.modules.payments import PaymentsModule
from ecollect.modules.reconciliation import ReconciliationModule
from ecollect.modules.session import SessionModule
from ecollect.modules.tokens import TokensModule
from ecollect.modules.webhooks import WebhooksModule
from ecollect.utils.http import AsyncHttpClient
from typing import Optional


class EcollectClient:
    """Top-level client for the ecollect payment gateway API.

    Usage::

        from ecollect import EcollectClient

        client = EcollectClient(
            api_key="your-api-key",
            ety_code=123,
            environment="test",
            srv_code=456,  # optional default service code
        )

        # Async
        payment = await client.payments.process(payment_intent)

        # Sync
        payment = client.payments.process_sync(payment_intent)
    """

    def __init__(
        self,
        api_key: str,
        ety_code: int,
        environment: str = "test",
        srv_code: Optional[int] = None,
        timeout: float = 30.0,
    ) -> None:
        self.config = EcollectConfig(
            api_key=api_key,
            ety_code=ety_code,
            environment=environment,
            srv_code=srv_code,
        )
        self._http = AsyncHttpClient(timeout=timeout)
        self.session = SessionModule(self.config, self._http)
        self.payments = PaymentsModule(self.config, self._http, self.session)
        self.tokens = TokensModule(self.config, self._http, self.session)
        self.webhooks = WebhooksModule(self.config, self._http, self.session)
        self.reconciliation = ReconciliationModule(self.config, self._http, self.session)
        self.customers = CustomersModule(self.config, self._http, self.session)
        self.payment_systems = PaymentSystemsModule(self.config, self._http, self.session)
        self.payment_links = PaymentLinksModule(self.config, self._http, self.session)

    async def close(self) -> None:
        """Close the underlying HTTP client."""
        await self._http.close()

    async def __aenter__(self) -> "EcollectClient":
        return self

    async def __aexit__(self, *args) -> None:
        await self.close()
