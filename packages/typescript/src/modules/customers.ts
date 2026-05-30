/**
 * CustomersModule: getOrCreate and update customer IDs for tokenisation.
 */

import { mapReturnCodeToError, CustomerException } from '../errors/index.js';
import type { EcollectConfig } from '../config.js';
import { BASE_URLS } from '../config.js';
import type {
  GetCustomerIdRequest,
  GetCustomerIdResponse,
  PaymentInfoItem,
} from '../types/api.js';
import type { CustomerInfo, EcollectCustomer } from '../types/index.js';
import type { HttpClient } from '../utils/http.js';
import type { SessionModule } from './session.js';

function info(code: number, desc: string, value: string | undefined): PaymentInfoItem | null {
  if (!value) return null;
  return { AttributeCode: code, AttributeDesc: desc, AttributeValue: value };
}

export class CustomersModule {
  private readonly config: EcollectConfig;
  private readonly http: HttpClient;
  private readonly session: SessionModule;

  constructor(config: EcollectConfig, http: HttpClient, session: SessionModule) {
    this.config = config;
    this.http = http;
    this.session = session;
  }

  /**
   * Get or create a CustomerId for a customer.
   * Returns existing CustomerId if the customer already exists.
   */
  async getOrCreateCustomerId(customerInfo: CustomerInfo): Promise<EcollectCustomer> {
    const url = `${BASE_URLS[this.config.environment]}/getCustomerId`;
    const sessionToken = await this.session.getActive();

    const customerInfoArray: PaymentInfoItem[] = [
      { AttributeCode: 6, AttributeDesc: 'Usermail', AttributeValue: customerInfo.email },
      { AttributeCode: 19, AttributeDesc: 'CardHolderId', AttributeValue: customerInfo.documentNumber },
      { AttributeCode: 18, AttributeDesc: 'CardHolderIdType', AttributeValue: customerInfo.documentType },
      { AttributeCode: 17, AttributeDesc: 'CardHolderName', AttributeValue: customerInfo.fullName },
      { AttributeCode: 7, AttributeDesc: 'MobileCountryCode', AttributeValue: customerInfo.mobileCountryCode },
      { AttributeCode: 8, AttributeDesc: 'MobileNumber', AttributeValue: customerInfo.mobileNumber },
    ].filter((x) => x.AttributeValue) as PaymentInfoItem[];

    const body: GetCustomerIdRequest = {
      EntityCode: this.config.etyCode,
      SessionToken: sessionToken,
      CustomerInfoArray: customerInfoArray,
    };

    const res = await this.http.post<GetCustomerIdRequest, GetCustomerIdResponse>(url, body);

    if (res.ReturnCode === 'FAIL_APIEXPIREDSESSION') {
      this.session.invalidate();
      body.SessionToken = await this.session.getActive();
      const retried = await this.http.post<GetCustomerIdRequest, GetCustomerIdResponse>(url, body);
      if (retried.ReturnCode !== 'SUCCESS') {
        throw mapReturnCodeToError(retried.ReturnCode);
      }
      return this._parseCustomer(retried, customerInfo);
    }

    if (res.ReturnCode !== 'SUCCESS') {
      throw mapReturnCodeToError(res.ReturnCode);
    }

    return this._parseCustomer(res, customerInfo);
  }

  /**
   * Update customer information by providing a CustomerId.
   */
  async updateCustomerInfo(
    customerId: string,
    updatedInfo: Partial<CustomerInfo>,
  ): Promise<EcollectCustomer> {
    const url = `${BASE_URLS[this.config.environment]}/getCustomerId`;
    const sessionToken = await this.session.getActive();

    const items: Array<PaymentInfoItem | null> = [
      { AttributeCode: 100, AttributeDesc: 'CustomerId', AttributeValue: customerId },
      info(6, 'Usermail', updatedInfo.email),
      info(17, 'CardHolderName', updatedInfo.fullName),
      info(18, 'CardHolderIdType', updatedInfo.documentType),
      info(7, 'MobileCountryCode', updatedInfo.mobileCountryCode),
      info(8, 'MobileNumber', updatedInfo.mobileNumber),
    ];

    const customerInfoArray = items.filter((x): x is PaymentInfoItem => x !== null);

    const body: GetCustomerIdRequest = {
      EntityCode: this.config.etyCode,
      SessionToken: sessionToken,
      CustomerInfoArray: customerInfoArray,
    };

    const res = await this.http.post<GetCustomerIdRequest, GetCustomerIdResponse>(url, body);

    if (res.ReturnCode !== 'SUCCESS') {
      throw mapReturnCodeToError(res.ReturnCode);
    }

    return this._parseCustomer(res, { ...updatedInfo, documentNumber: '' } as CustomerInfo);
  }

  private _parseCustomer(
    res: GetCustomerIdResponse,
    original: Partial<CustomerInfo>,
  ): EcollectCustomer {
    const arr = res.CustomerInfoArray ?? [];
    const findAttr = (code: number) => arr.find((i) => i.AttributeCode === code)?.AttributeValue;

    const customerId = findAttr(100);
    if (!customerId) {
      throw new CustomerException('getCustomerId response did not return a CustomerId');
    }

    return {
      customerId,
      email: original.email,
      fullName: original.fullName,
      documentType: original.documentType,
      documentNumber: original.documentNumber,
      mobileCountryCode: original.mobileCountryCode,
      mobileNumber: original.mobileNumber,
    };
  }
}
