/**
 * Public SDK types (semantic / merchant-facing)
 */

export type Environment = 'test' | 'prod';
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';
export type PaymentLinkMethod = 'email' | 'sms' | 'qr';
export type TranState =
  | 'OK'
  | 'NOT_AUTHORIZED'
  | 'BANK'
  | 'PENDING'
  | 'CAPTURED'
  | 'CREATED'
  | 'EXPIRED'
  | 'FAILED';

/** Account type for card */
export type AccountType = 0 | 1; // 0=Credit, 1=Debit

// ---------------------------------------------------------------------------
// Customer
// ---------------------------------------------------------------------------

export interface Customer {
  /** Full name of the card holder / payer */
  fullName: string;
  email: string;
  phone?: string;
  /** Document type: e.g. CC, NIT, CI, CURP, etc. */
  documentType?: string;
  documentNumber?: string;
  /** Mobile country code, e.g. "57" for Colombia */
  mobileCountryCode?: string;
  mobileNumber?: string;
}

// ---------------------------------------------------------------------------
// CardData (for tokenisation)
// ---------------------------------------------------------------------------

export interface CardData {
  cardNumber: string;
  expirationDate: string; // MM/YYYY
  secureCode?: string;
  cardHolderName: string;
  cardHolderIdType: string;
  cardHolderId: string;
  /** Payment system code (1 = CC Colombia, 3 = VISANET RD, 6 = CARDNET RD) */
  paymentSystem: string;
  fiCode: string;
  accountType?: AccountType;
  cardIssueBank?: string;
  cardIssueCountry?: string;
  /** If obtained via getCustomerId */
  customerId?: string;
  email?: string;
  mobileCountryCode?: string;
  mobileNumber?: string;
}

// ---------------------------------------------------------------------------
// SavedCard
// ---------------------------------------------------------------------------

export interface SavedCard {
  tokenId: string;
  maskedCard?: string;
  last4?: string;
  bin4?: string;
  paymentSystem?: string;
  fiCode?: string;
  fiName?: string;
  brandImageUrl?: string;
  tokenStatus?: 'ACTIVE' | 'VERIFY' | 'EXPIRED';
  lifetimeSecs?: number;
  email?: string;
  customerId?: string;
  /** OTP required flag */
  requiresOneTimePassword?: boolean;
}

// ---------------------------------------------------------------------------
// Subservice (payment dispersion)
// ---------------------------------------------------------------------------

export interface Subservice {
  entityCode: number;
  srvCode: string;
  valueType: 0 | 1;
  transValue: number;
  transVatValue?: number;
}

// ---------------------------------------------------------------------------
// PaymentIntent
// ---------------------------------------------------------------------------

export interface PaymentIntent {
  amount: number;
  /** Optional tax/VAT amount */
  vatAmount?: number;
  currency: string; // ISO 4217: COP, MXN, DOP, USD
  /** Service code. Falls back to client config.srvCode if omitted */
  srvCode?: number;
  merchantTransactionId?: string;
  customer: Customer;
  /** Payment system code string: "0"=PSE, "1"=CC CO, "3"=VISANET, "6"=CARDNET, "7"=SPEI, "10"=Link, "100"=Cash */
  paymentSystem?: string;
  fiCode?: string;
  /** Redirect URL after payment */
  redirectUrl?: string;
  /** Webhook endpoint URL */
  responseUrl?: string;
  langCode?: string;
  invoice?: string;
  /** Format: yyyyMMddHHmmss */
  invoiceDueDate?: string;
  policyCode?: string;
  /** Extra items for ReferenceArray beyond [0..5] */
  additionalReferences?: string[];
  /** Pre-built PaymentInfoArray extras (e.g., Installments, UserType) */
  paymentInfo?: Record<string, string>;
  /** For card payments using a saved token */
  tokenId?: string;
  secureCode?: string;
  installments?: number;
  /** UserType for PSE: "0"=Natural, "1"=Juridica */
  userType?: string;
  ipAddress?: string;
  deviceFingerPrint?: string;
  oneTimePassword?: string;
  /** Subservice dispersion array */
  subservices?: Subservice[];
  /** For QR payment links */
  qrLifetimeSecs?: number;
}

// ---------------------------------------------------------------------------
// Transaction result
// ---------------------------------------------------------------------------

export interface TransactionResult {
  returnCode: string;
  ticketId?: number;
  /** Redirect URL when ecollect handles payment UI */
  eCollectUrl?: string;
  lifetimeSecs?: number;
  tranState?: TranState;
  trazabilityCode?: string;
  transValue?: number;
  transVatValue?: number;
  payCurrency?: string;
  currencyRate?: number;
  bankProcessDate?: string;
  fiCode?: string;
  fiName?: string;
  paymentSystem?: string;
  tranCycle?: string;
  invoice?: string;
  referenceArray?: string[];
  srvCode?: number;
  paymentInfoArray?: Array<{ code: number; desc: string; value: string }>;
}

// ---------------------------------------------------------------------------
// Payment Systems
// ---------------------------------------------------------------------------

export interface FiImage {
  fiCode: string;
  findKeys?: string;
  brandImageUrl?: string;
}

export interface FinancialInstitution {
  fiCode: string;
  fiName: string;
}

export interface PaymentSystem {
  paymentSystem: string;
  brandImageUrl?: string;
  fiImages?: FiImage[];
  financialInstitutions?: FinancialInstitution[];
}

// ---------------------------------------------------------------------------
// Customer (ecollect)
// ---------------------------------------------------------------------------

export interface EcollectCustomer {
  customerId: string;
  email?: string;
  fullName?: string;
  documentType?: string;
  documentNumber?: string;
  mobileCountryCode?: string;
  mobileNumber?: string;
}

export interface CustomerInfo {
  email: string;
  fullName: string;
  documentType: string;
  documentNumber: string;
  mobileCountryCode: string;
  mobileNumber: string;
  /** Provide to update existing customer */
  customerId?: string;
}

// ---------------------------------------------------------------------------
// Payment link result
// ---------------------------------------------------------------------------

export interface PaymentLinkResult {
  eCollectUrl?: string;
  ticketId?: number;
  lifetimeSecs?: number;
  expiresAt: Date;
}

// ---------------------------------------------------------------------------
// Session
// ---------------------------------------------------------------------------

export interface SessionToken {
  token: string;
  expiresAt: Date;
  lifetimeSecs: number;
}
