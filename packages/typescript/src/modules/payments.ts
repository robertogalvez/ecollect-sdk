/**
 * PaymentsModule: process, pre-authorize, capture, void, hosted checkout.
 */

import { mapReturnCodeToError, ValidationException } from '../errors/index.js';
import type { EcollectConfig } from '../config.js';
import { BASE_URLS } from '../config.js';
import type {
  CreateTransactionRequest,
  CreateTransactionResponse,
  PaymentInfoItem,
  SubserviceItem,
} from '../types/api.js';
import type { PaymentIntent, TransactionResult } from '../types/index.js';
import type { HttpClient } from '../utils/http.js';
import type { SessionModule } from './session.js';
import { validatePaymentIntent } from '../utils/validators.js';

/** States where a double-payment retry must be blocked */
const DOUBLE_PAYMENT_STATES = ['BANK', 'PENDING', 'CAPTURED', 'CREATED'];

function buildReferenceArray(intent: PaymentIntent): string[] {
  const c = intent.customer;
  const refs: string[] = [
    c.documentType ?? '',
    c.documentNumber ?? '',
    intent.merchantTransactionId ?? '',
    c.fullName ?? '',
    c.email ?? '',
    c.phone ?? '',
  ];
  if (intent.additionalReferences) {
    refs.push(...intent.additionalReferences);
  }
  return refs;
}

function info(code: number, desc: string, value: string | number | undefined): PaymentInfoItem | null {
  if (value === undefined || value === null || value === '') return null;
  return { AttributeCode: code, AttributeDesc: desc, AttributeValue: String(value) };
}

function buildPaymentInfoArray(intent: PaymentIntent): PaymentInfoItem[] {
  const items: Array<PaymentInfoItem | null> = [
    info(6, 'Usermail', intent.customer.email),
    info(17, 'CardHolderName', intent.customer.fullName),
    info(18, 'CardHolderIdType', intent.customer.documentType),
    info(19, 'CardHolderId', intent.customer.documentNumber),
    info(23, 'IPAddress', intent.ipAddress),
    info(24, 'DeviceFingerPrint', intent.deviceFingerPrint),
    info(25, 'OneTimePassword', intent.oneTimePassword),
    info(26, 'MerchantTransactionId', intent.merchantTransactionId),
    info(34, 'UserType', intent.userType),
  ];

  // Extra paymentInfo map
  if (intent.paymentInfo) {
    for (const [desc, value] of Object.entries(intent.paymentInfo)) {
      // For known descriptors map to code; otherwise skip (desc is used as desc)
      items.push({ AttributeCode: 0, AttributeDesc: desc, AttributeValue: value });
    }
  }

  return items.filter((x): x is PaymentInfoItem => x !== null);
}

function buildTokenInfoArray(intent: PaymentIntent): PaymentInfoItem[] | undefined {
  if (!intent.tokenId) return undefined;

  const items: Array<PaymentInfoItem | null> = [
    info(1, 'TokenId', intent.tokenId),
    info(2, 'PaymentSystem', intent.paymentSystem),
    info(3, 'SecureCode', intent.secureCode),
    info(5, 'Installments', intent.installments),
    info(6, 'Usermail', intent.customer.email),
    info(9, 'FiCode', intent.fiCode),
    info(19, 'CardHolderId', intent.customer.documentNumber),
    info(25, 'OneTimePassword', intent.oneTimePassword),
  ];

  return items.filter((x): x is PaymentInfoItem => x !== null);
}

function buildSubservices(intent: PaymentIntent): SubserviceItem[] | undefined {
  if (!intent.subservices || intent.subservices.length === 0) return undefined;
  return intent.subservices.map((s) => ({
    EntityCode: s.entityCode,
    SrvCode: String(s.srvCode),
    ValueType: s.valueType,
    TransValue: s.transValue,
    TransVatValue: s.transVatValue,
  }));
}

function mapResponse(res: CreateTransactionResponse): TransactionResult {
  const tr = res.TransactionResponse;
  return {
    returnCode: res.ReturnCode,
    ticketId: res.TicketId ?? tr?.TicketId,
    eCollectUrl: res.eCollectUrl,
    lifetimeSecs: res.LifetimeSecs,
    tranState: (tr?.TranState as TransactionResult['tranState']) ?? undefined,
    trazabilityCode: tr?.TrazabilityCode,
    transValue: tr?.TransValue,
    transVatValue: tr?.TransVatValue,
    payCurrency: tr?.PayCurrency,
    currencyRate: tr?.CurrencyRate,
    bankProcessDate: tr?.BankProcessDate,
    fiCode: tr?.FICode,
    fiName: tr?.FiName,
    paymentSystem: tr?.PaymentSystem,
    tranCycle: tr?.TransCycle,
    invoice: tr?.Invoice,
    referenceArray: tr?.ReferenceArray,
    srvCode: tr?.SrvCode,
    paymentInfoArray: tr?.PaymentInfoArray?.map((i) => ({
      code: i.AttributeCode,
      desc: i.AttributeDesc,
      value: i.AttributeValue,
    })),
  };
}

export class PaymentsModule {
  private readonly config: EcollectConfig;
  private readonly http: HttpClient;
  private readonly session: SessionModule;

  constructor(config: EcollectConfig, http: HttpClient, session: SessionModule) {
    this.config = config;
    this.http = http;
    this.session = session;
  }

  private get baseUrl(): string {
    return BASE_URLS[this.config.environment];
  }

  private async _send(
    body: Omit<CreateTransactionRequest, 'SessionToken'>,
  ): Promise<TransactionResult> {
    const url = `${this.baseUrl}/createTransactionPayment`;
    const sessionToken = await this.session.getActive();

    const fullBody: CreateTransactionRequest = { ...body, SessionToken: sessionToken };

    const res = await this.http.post<CreateTransactionRequest, CreateTransactionResponse>(
      url,
      fullBody,
    );

    if (res.ReturnCode === 'FAIL_APIEXPIREDSESSION') {
      this.session.invalidate();
      fullBody.SessionToken = await this.session.getActive();
      const retried = await this.http.post<CreateTransactionRequest, CreateTransactionResponse>(
        url,
        fullBody,
      );
      if (retried.ReturnCode !== 'SUCCESS') {
        throw mapReturnCodeToError(retried.ReturnCode);
      }
      return mapResponse(retried);
    }

    if (res.ReturnCode !== 'SUCCESS') {
      throw mapReturnCodeToError(res.ReturnCode);
    }

    return mapResponse(res);
  }

  /**
   * Process a payment (RequestType=0 — immediate authorization).
   */
  async process(intent: PaymentIntent): Promise<TransactionResult> {
    validatePaymentIntent(intent, this.config.etyCode);

    const srvCode = intent.srvCode ?? this.config.srvCode;
    if (!srvCode) {
      throw new ValidationException('srvCode is required (set in PaymentIntent or EcollectClient config)');
    }

    return this._send({
      EntityCode: this.config.etyCode,
      SrvCode: srvCode,
      TransValue: intent.amount,
      TransVatValue: intent.vatAmount,
      SrvCurrency: intent.currency,
      URLRedirect: intent.redirectUrl,
      URLResponse: intent.responseUrl,
      LangCode: intent.langCode ?? 'ES',
      PaymentSystem: intent.paymentSystem,
      FICode: intent.fiCode,
      Invoice: intent.invoice,
      InvoiceDueDate: intent.invoiceDueDate,
      PolicyCode: intent.policyCode,
      RequestType: 0,
      ReferenceArray: buildReferenceArray(intent),
      SubservicesArray: buildSubservices(intent),
      PaymentInfoArray: buildPaymentInfoArray(intent),
      TokenInfoArray: buildTokenInfoArray(intent),
    });
  }

  /**
   * Pre-authorize a payment (RequestType=1 — reserve funds).
   */
  async preAuthorize(intent: PaymentIntent): Promise<TransactionResult> {
    validatePaymentIntent(intent, this.config.etyCode);

    const srvCode = intent.srvCode ?? this.config.srvCode;
    if (!srvCode) {
      throw new ValidationException('srvCode is required');
    }

    return this._send({
      EntityCode: this.config.etyCode,
      SrvCode: srvCode,
      TransValue: intent.amount,
      TransVatValue: intent.vatAmount,
      SrvCurrency: intent.currency,
      URLRedirect: intent.redirectUrl,
      URLResponse: intent.responseUrl,
      LangCode: intent.langCode ?? 'ES',
      PaymentSystem: intent.paymentSystem,
      FICode: intent.fiCode,
      PolicyCode: intent.policyCode,
      RequestType: 1,
      ReferenceArray: buildReferenceArray(intent),
      SubservicesArray: buildSubservices(intent),
      PaymentInfoArray: buildPaymentInfoArray(intent),
      TokenInfoArray: buildTokenInfoArray(intent),
    });
  }

  /**
   * Capture a pre-authorized payment (RequestType = ticketId positive).
   */
  async capture(ticketId: number, finalAmount?: number): Promise<TransactionResult> {
    if (!ticketId || ticketId <= 0) {
      throw new ValidationException('ticketId must be a positive number');
    }

    return this._send({
      EntityCode: this.config.etyCode,
      RequestType: ticketId,
      TransValue: finalAmount,
    });
  }

  /**
   * Void a pre-authorized payment (RequestType = -ticketId).
   */
  async void(ticketId: number): Promise<TransactionResult> {
    if (!ticketId || ticketId <= 0) {
      throw new ValidationException('ticketId must be a positive number');
    }

    return this._send({
      EntityCode: this.config.etyCode,
      RequestType: -ticketId,
    });
  }

  /**
   * Hosted checkout: redirect user to ecollect payment page.
   * Returns the eCollectUrl for redirect.
   */
  async hostedCheckout(intent: PaymentIntent): Promise<TransactionResult> {
    if (!intent.redirectUrl) {
      throw new ValidationException('redirectUrl is required for hostedCheckout');
    }
    return this.process(intent);
  }

  /**
   * Process with additional PaymentInfoItems injected (used by PaymentLinksModule).
   * @internal
   */
  async _processWithExtraInfo(
    intent: PaymentIntent,
    extraInfo: PaymentInfoItem[],
  ): Promise<TransactionResult> {
    validatePaymentIntent(intent, this.config.etyCode);

    const srvCode = intent.srvCode ?? this.config.srvCode;
    if (!srvCode) {
      throw new ValidationException('srvCode is required');
    }

    const paymentInfoArray = [...buildPaymentInfoArray(intent), ...extraInfo];

    return this._send({
      EntityCode: this.config.etyCode,
      SrvCode: srvCode,
      TransValue: intent.amount,
      TransVatValue: intent.vatAmount,
      SrvCurrency: intent.currency,
      URLRedirect: intent.redirectUrl,
      URLResponse: intent.responseUrl,
      LangCode: intent.langCode ?? 'ES',
      PaymentSystem: intent.paymentSystem,
      FICode: intent.fiCode,
      Invoice: intent.invoice,
      InvoiceDueDate: intent.invoiceDueDate,
      PolicyCode: intent.policyCode,
      RequestType: 0,
      ReferenceArray: buildReferenceArray(intent),
      SubservicesArray: buildSubservices(intent),
      PaymentInfoArray: paymentInfoArray,
      TokenInfoArray: buildTokenInfoArray(intent),
    });
  }

  /**
   * Check if a transaction state prevents retry (double-payment guard).
   */
  static isDoublePaymentState(tranState: string): boolean {
    return DOUBLE_PAYMENT_STATES.includes(tranState);
  }
}
