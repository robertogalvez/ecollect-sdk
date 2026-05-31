/**
 * ecollect TypeScript/JavaScript SDK
 * @packageDocumentation
 */

export { EcollectClient } from './client.js';
export type { EcollectConfig } from './config.js';
export { DEFAULT_CONFIG, BASE_URLS, TRANSACTION_INFO_URLS } from './config.js';

// Public types
export type {
  Environment,
  LogLevel,
  PaymentLinkMethod,
  TranState,
  AccountType,
  Customer,
  CardData,
  SavedCard,
  Subservice,
  PaymentIntent,
  TransactionResult,
  FiImage,
  FinancialInstitution,
  PaymentSystem,
  EcollectCustomer,
  CustomerInfo,
  PaymentLinkResult,
  SessionToken,
} from './types/index.js';

// API types (for advanced usage)
export type {
  PaymentInfoItem,
  ChannelInfoItem,
  SubserviceItem,
  GetSessionTokenRequest,
  GetSessionTokenResponse,
  CreateTransactionRequest,
  CreateTransactionResponse,
  TransactionInfoResponse,
  GetTransactionInformationRequest,
  VerifySessionTokenRequest,
  VerifySessionTokenResponse,
  GetPaymentSystemRequest,
  GetPaymentSystemResponse,
  PaymentSystemItem,
  GetCustomerIdRequest,
  GetCustomerIdResponse,
  TokenCommand,
  TokenCommandRequest,
  TokenCommandResponse,
  QueryTokenRequest,
  QueryTokenResponse,
  WebhookPayload,
} from './types/api.js';

// Errors
export {
  EcollectError,
  SessionExpiredException,
  InvalidConfigException,
  ValidationException,
  InvalidCardException,
  InsufficientFundsException,
  NetworkRetryableException,
  TokenNotFoundException,
  TokenExpiredException,
  TokenValidationException,
  DuplicateTransactionException,
  DuplicateInvoiceException,
  AuthenticationException,
  WebhookValidationException,
  CustomerException,
  CustomerNotFoundException,
  CardMismatchException,
  TicketNotFoundException,
  PollingTimeoutException,
  PolicyConfigException,
  mapReturnCodeToError,
} from './errors/index.js';

// Utilities
export { luhnCheck, validateEmail, validatePaymentIntent, validateByCountry } from './utils/validators.js';
export { hmacSha256, timingSafeEqual } from './utils/crypto.js';
export { PollingManager } from './utils/polling.js';

// Modules (for advanced DI usage)
export { SessionModule } from './modules/session.js';
export { PaymentsModule } from './modules/payments.js';
export { TokensModule } from './modules/tokens.js';
export { WebhooksModule } from './modules/webhooks.js';
export { ReconciliationModule } from './modules/reconciliation.js';
export { CustomersModule } from './modules/customers.js';
export { PaymentSystemsModule } from './modules/paymentSystems.js';
export { PaymentLinksModule } from './modules/paymentLinks.js';

// Sandbox (testing / development only)
export { SandboxInterceptor, SANDBOX_SCENARIOS, sandbox } from './sandbox/index.js';
export type { SandboxScenario } from './sandbox/index.js';
