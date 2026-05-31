"""TypedDicts for raw API request/response payloads."""
from typing import Any, Dict, List, Optional
from typing_extensions import TypedDict, NotRequired


class PaymentInfoItem(TypedDict):
    AttributeCode: int
    AttributeDesc: str
    AttributeValue: str


class GetSessionTokenRequest(TypedDict):
    EntityCode: int
    ApiKey: str


class GetSessionTokenResponse(TypedDict):
    ReturnCode: str
    SessionToken: NotRequired[str]
    LifetimeSecs: NotRequired[int]


class CreateTransactionRequest(TypedDict, total=False):
    EntityCode: int
    SessionToken: str
    SrvCode: int
    TransValue: float
    SrvCurrency: str
    ReferenceArray: List[str]
    TransVatValue: float
    URLRedirect: str
    URLResponse: str
    LangCode: str
    PaymentSystem: int
    FICode: str
    Invoice: str
    InvoiceDueDate: str
    PolicyCode: str
    RequestType: Any
    PaymentInfoArray: List[PaymentInfoItem]
    TokenInfoArray: List[PaymentInfoItem]
    SubservicesArray: List[Dict[str, Any]]


class TransactionResponse(TypedDict, total=False):
    ReturnCode: str
    TicketId: int
    eCollectUrl: str
    LifetimeSecs: int
    TranState: str
    TransValue: float
    TransVatValue: float
    PayCurrency: str
    BankProcessDate: str
    FICode: str
    FiName: str
    PaymentSystem: str
    ReferenceArray: List[str]
    SrvCode: int
    PaymentInfoArray: List[PaymentInfoItem]


class GetTransactionRequest(TypedDict, total=False):
    EntityCode: int
    SessionToken: str
    TicketId: int
    PaymentInfoArray: List[PaymentInfoItem]


class TokenCommandRequest(TypedDict, total=False):
    EntityCode: int
    SessionToken: str
    Command: str
    TokenInfoArray: List[PaymentInfoItem]


class QueryTokenRequest(TypedDict, total=False):
    EntityCode: int
    SessionToken: str
    TokenInfoArray: List[PaymentInfoItem]


class GetCustomerIdRequest(TypedDict, total=False):
    EntityCode: int
    SessionToken: str
    CustomerInfoArray: List[PaymentInfoItem]


class VerifySessionTokenRequest(TypedDict, total=False):
    EntityCode: int
    SessionToken: str
    SessionTokenToVerify: str
    TicketIdToVerify: int
