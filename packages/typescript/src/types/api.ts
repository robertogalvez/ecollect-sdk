/**
 * Raw API request/response types mirroring the ecollect API exactly.
 */

// ---------------------------------------------------------------------------
// Shared
// ---------------------------------------------------------------------------

export interface PaymentInfoItem {
  AttributeCode: number;
  AttributeDesc: string;
  AttributeValue: string;
}

export interface ChannelInfoItem {
  AttributeCode: number;
  AttributeDesc: string;
  AttributeValue: string;
}

export interface SubserviceItem {
  EntityCode: number;
  SrvCode: string;
  ValueType: 0 | 1; // 0=fixed, 1=percentage
  TransValue: number;
  TransVatValue?: number;
}

// ---------------------------------------------------------------------------
// getSessionToken
// ---------------------------------------------------------------------------

export interface GetSessionTokenRequest {
  EntityCode: number;
  ApiKey: string;
}

export interface GetSessionTokenResponse {
  ReturnCode: string;
  SessionToken?: string;
  LifetimeSecs?: number;
}

// ---------------------------------------------------------------------------
// createTransactionPayment
// ---------------------------------------------------------------------------

export interface CreateTransactionRequest {
  EntityCode: number;
  SessionToken: string;
  SrvCode?: number;
  TransValue?: number;
  TransVatValue?: number;
  SrvCurrency?: string;
  URLRedirect?: string;
  URLResponse?: string;
  LangCode?: string;
  PaymentSystem?: string | number;
  FICode?: string;
  Invoice?: string;
  InvoiceDueDate?: string;
  PolicyCode?: string;
  RequestType?: number;
  ReferenceArray?: string[];
  SubservicesArray?: SubserviceItem[];
  PaymentInfoArray?: PaymentInfoItem[];
  TokenInfoArray?: PaymentInfoItem[];
  ChannelInfoArray?: ChannelInfoItem[];
}

export interface TransactionInfoResponse {
  EntityCode?: number;
  TicketId?: number;
  TrazabilityCode?: string;
  TranState?: string;
  ReturnCode: string;
  TransValue?: number;
  TransVatValue?: number;
  PayCurrency?: string;
  CurrencyRate?: number;
  BankProcessDate?: string;
  FICode?: string;
  FiName?: string;
  PaymentSystem?: string;
  TransCycle?: string;
  Invoice?: string;
  ReferenceArray?: string[];
  SrvCode?: number;
  PaymentInfoArray?: PaymentInfoItem[];
  ChannelInfoArray?: ChannelInfoItem[];
}

export interface CreateTransactionResponse {
  ReturnCode: string;
  TicketId?: number;
  eCollectUrl?: string;
  LifetimeSecs?: number;
  TransactionResponse?: TransactionInfoResponse;
}

// ---------------------------------------------------------------------------
// getTransactionInformation
// ---------------------------------------------------------------------------

export interface GetTransactionInformationRequest {
  EntityCode: number;
  SessionToken: string;
  TicketId?: number;
  PaymentInfoArray?: PaymentInfoItem[];
}

// Response reuses TransactionInfoResponse

// ---------------------------------------------------------------------------
// verifySessionToken
// ---------------------------------------------------------------------------

export interface VerifySessionTokenRequest {
  EntityCode: number;
  SessionToken: string;
  SessionTokenToVerify: string;
  TicketIdToVerify?: number;
}

export interface VerifySessionTokenResponse {
  ReturnCode: string;
}

// ---------------------------------------------------------------------------
// getPaymentSystem
// ---------------------------------------------------------------------------

export interface GetPaymentSystemRequest {
  EntityCode: number;
  SessionToken: string;
}

export interface FiImageItem {
  FiCode: string;
  FindKeys?: string;
  BrandImageUrl?: string;
}

export interface FiItem {
  FiCode: string;
  FiName: string;
}

export interface PaymentSystemItem {
  PaymentSystem: string;
  BrandImageUrl?: string;
  FiImagesArray?: FiImageItem[];
  FiArray?: FiItem[];
}

export interface GetPaymentSystemResponse {
  ReturnCode: string;
  PaymentSystemArray?: PaymentSystemItem[];
}

// ---------------------------------------------------------------------------
// getCustomerId
// ---------------------------------------------------------------------------

export interface GetCustomerIdRequest {
  EntityCode: number;
  SessionToken: string;
  CustomerInfoArray: PaymentInfoItem[];
}

export interface GetCustomerIdResponse {
  ReturnCode: string;
  CustomerInfoArray?: PaymentInfoItem[];
}

// ---------------------------------------------------------------------------
// tokenCommand
// ---------------------------------------------------------------------------

export type TokenCommand = 'GET' | 'SAVE' | 'REMOVE' | 'UPDATE' | 'HOLD';

export interface TokenCommandRequest {
  EntityCode: number;
  SessionToken: string;
  Command: TokenCommand;
  TokenInfoArray: PaymentInfoItem[];
}

export interface TokenCommandResponse {
  ReturnCode: string;
  TokenInfoArray?: PaymentInfoItem[];
  LifetimeSecs?: number;
}

// ---------------------------------------------------------------------------
// queryToken
// ---------------------------------------------------------------------------

export interface QueryTokenRequest {
  EntityCode: number;
  SessionToken: string;
  TokenInfoArray?: PaymentInfoItem[];
}

export interface TokenRecord {
  TokenInfoArray?: PaymentInfoItem[];
  TokenStatus?: string;
  LifetimeSecs?: number;
}

export interface QueryTokenResponse {
  ReturnCode: string;
  TokenArray?: TokenRecord[];
}

// ---------------------------------------------------------------------------
// Webhook payload (same as TransactionInfoResponse + SessionToken)
// ---------------------------------------------------------------------------

export interface WebhookPayload extends TransactionInfoResponse {
  SessionToken?: string;
}
