/**
 * ReconciliationModule: transaction status query and polling reconciliation.
 */

import { mapReturnCodeToError } from '../errors/index.js';
import type { EcollectConfig } from '../config.js';
import { TRANSACTION_INFO_URLS } from '../config.js';
import type {
  GetTransactionInformationRequest,
  TransactionInfoResponse,
  PaymentInfoItem,
} from '../types/api.js';
import type { TransactionResult } from '../types/index.js';
import type { HttpClient } from '../utils/http.js';
import type { SessionModule } from './session.js';
import { PollingManager } from '../utils/polling.js';

function mapTxInfo(res: TransactionInfoResponse): TransactionResult {
  return {
    returnCode: res.ReturnCode,
    ticketId: res.TicketId,
    tranState: res.TranState as TransactionResult['tranState'],
    trazabilityCode: res.TrazabilityCode,
    transValue: res.TransValue,
    transVatValue: res.TransVatValue,
    payCurrency: res.PayCurrency,
    currencyRate: res.CurrencyRate,
    bankProcessDate: res.BankProcessDate,
    fiCode: res.FICode,
    fiName: res.FiName,
    paymentSystem: res.PaymentSystem,
    tranCycle: res.TransCycle,
    invoice: res.Invoice,
    referenceArray: res.ReferenceArray,
    srvCode: res.SrvCode,
    paymentInfoArray: res.PaymentInfoArray?.map((i) => ({
      code: i.AttributeCode,
      desc: i.AttributeDesc,
      value: i.AttributeValue,
    })),
  };
}

export class ReconciliationModule {
  private readonly config: EcollectConfig;
  private readonly http: HttpClient;
  private readonly session: SessionModule;
  private readonly pollingManager: PollingManager;

  constructor(config: EcollectConfig, http: HttpClient, session: SessionModule) {
    this.config = config;
    this.http = http;
    this.session = session;
    this.pollingManager = new PollingManager((ticketId) => this.getTransactionStatus(ticketId));
  }

  /**
   * Query the current state of a transaction.
   * Optionally pass merchantTransactionId as fallback.
   */
  async getTransactionStatus(
    ticketId: number,
    merchantTransactionId?: string,
  ): Promise<TransactionResult> {
    const url = TRANSACTION_INFO_URLS[this.config.environment];
    const sessionToken = await this.session.getActive();

    const paymentInfoArray: PaymentInfoItem[] | undefined = merchantTransactionId
      ? [{ AttributeCode: 26, AttributeDesc: 'MerchantTransactionId', AttributeValue: merchantTransactionId }]
      : undefined;

    const body: GetTransactionInformationRequest = {
      EntityCode: this.config.etyCode,
      SessionToken: sessionToken,
      TicketId: ticketId,
      PaymentInfoArray: paymentInfoArray,
    };

    const res = await this.http.post<GetTransactionInformationRequest, TransactionInfoResponse>(
      url,
      body,
    );

    if (res.ReturnCode === 'FAIL_APIEXPIREDSESSION') {
      this.session.invalidate();
      body.SessionToken = await this.session.getActive();
      const retried = await this.http.post<GetTransactionInformationRequest, TransactionInfoResponse>(
        url,
        body,
      );
      if (retried.ReturnCode !== 'SUCCESS') {
        throw mapReturnCodeToError(retried.ReturnCode);
      }
      return mapTxInfo(retried);
    }

    if (res.ReturnCode !== 'SUCCESS') {
      throw mapReturnCodeToError(res.ReturnCode);
    }

    return mapTxInfo(res);
  }

  /**
   * Start background polling for a transaction until a final state is reached.
   * @param ticketId - The ecollect ticket ID
   * @param timeout - Timeout in ms (default: 10 minutes)
   * @returns Promise that resolves to the final TransactionResult
   */
  async reconciliate(ticketId: number, timeout = 600_000): Promise<TransactionResult> {
    return this.pollingManager.waitForFinalState(ticketId, timeout);
  }

  /**
   * Stop an in-progress reconciliation poll.
   */
  stopReconciliation(ticketId: number): void {
    this.pollingManager.stopPolling(ticketId);
  }
}
