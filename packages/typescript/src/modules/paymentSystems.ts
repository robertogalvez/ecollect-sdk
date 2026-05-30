/**
 * PaymentSystemsModule: fetch available payment methods for the merchant.
 */

import { mapReturnCodeToError } from '../errors/index.js';
import type { EcollectConfig } from '../config.js';
import { BASE_URLS } from '../config.js';
import type { GetPaymentSystemRequest, GetPaymentSystemResponse } from '../types/api.js';
import type { PaymentSystem, FiImage, FinancialInstitution } from '../types/index.js';
import type { HttpClient } from '../utils/http.js';
import type { SessionModule } from './session.js';

export class PaymentSystemsModule {
  private readonly config: EcollectConfig;
  private readonly http: HttpClient;
  private readonly session: SessionModule;

  constructor(config: EcollectConfig, http: HttpClient, session: SessionModule) {
    this.config = config;
    this.http = http;
    this.session = session;
  }

  /**
   * Retrieve all payment systems enabled for this merchant.
   */
  async getPaymentSystems(): Promise<PaymentSystem[]> {
    const url = `${BASE_URLS[this.config.environment]}/getPaymentSystem`;
    const sessionToken = await this.session.getActive();

    const body: GetPaymentSystemRequest = {
      EntityCode: this.config.etyCode,
      SessionToken: sessionToken,
    };

    const res = await this.http.post<GetPaymentSystemRequest, GetPaymentSystemResponse>(url, body);

    if (res.ReturnCode === 'NO_RECORDS') return [];
    if (res.ReturnCode === 'FAIL_APIEXPIREDSESSION') {
      this.session.invalidate();
      body.SessionToken = await this.session.getActive();
      const retried = await this.http.post<GetPaymentSystemRequest, GetPaymentSystemResponse>(
        url,
        body,
      );
      if (retried.ReturnCode !== 'SUCCESS' && retried.ReturnCode !== 'NO_RECORDS') {
        throw mapReturnCodeToError(retried.ReturnCode);
      }
      return this._map(retried);
    }

    if (res.ReturnCode !== 'SUCCESS') {
      throw mapReturnCodeToError(res.ReturnCode);
    }

    return this._map(res);
  }

  private _map(res: GetPaymentSystemResponse): PaymentSystem[] {
    if (!res.PaymentSystemArray) return [];
    return res.PaymentSystemArray.map((ps) => ({
      paymentSystem: ps.PaymentSystem,
      brandImageUrl: ps.BrandImageUrl,
      fiImages: ps.FiImagesArray?.map(
        (fi): FiImage => ({
          fiCode: fi.FiCode,
          findKeys: fi.FindKeys,
          brandImageUrl: fi.BrandImageUrl,
        }),
      ),
      financialInstitutions: ps.FiArray?.map(
        (fi): FinancialInstitution => ({
          fiCode: fi.FiCode,
          fiName: fi.FiName,
        }),
      ),
    }));
  }
}
