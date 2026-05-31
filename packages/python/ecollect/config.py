"""Configuration dataclass and URL constants for the ecollect SDK."""
from dataclasses import dataclass, field
from typing import Optional

TEST_BASE_URL = "https://test1.e-collect.com/app_express/api/"
PROD_BASE_URL = "https://www.e-collect.com/app_Express/api/"
PROD_GET_TRANSACTION_URL = "https://m.e-collect.com/app_Express/api/GetTransactionInformation"

# Endpoint paths (appended to base URL)
ENDPOINTS = {
    "getSessionToken": "getSessionToken",
    "createTransactionPayment": "createTransactionPayment",
    "getTransactionInformation": "getTransactionInformation",
    "getPaymentSystem": "getPaymentSystem",
    "tokenCommand": "tokenCommand",
    "queryToken": "queryToken",
    "getCustomerId": "getCustomerId",
    "verifySessionToken": "verifySessionToken",
}


@dataclass
class EcollectConfig:
    """Configuration for the EcollectClient."""

    api_key: str
    ety_code: int
    environment: str = "test"
    srv_code: Optional[int] = None

    def __post_init__(self) -> None:
        if self.environment not in ("test", "prod"):
            raise ValueError("environment must be 'test' or 'prod'")
        if not self.api_key:
            raise ValueError("api_key is required")
        if not self.ety_code:
            raise ValueError("ety_code is required")

    @property
    def base_url(self) -> str:
        if self.environment == "prod":
            return PROD_BASE_URL
        return TEST_BASE_URL

    def endpoint_url(self, endpoint: str) -> str:
        """Return full URL for a given endpoint name."""
        path = ENDPOINTS.get(endpoint, endpoint)
        # getTransactionInformation in prod uses a different host
        if endpoint == "getTransactionInformation" and self.environment == "prod":
            return PROD_GET_TRANSACTION_URL
        return self.base_url + path
