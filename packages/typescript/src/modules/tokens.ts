/**
 * TokensModule: tokenisation commands and saved card management.
 */

import { mapReturnCodeToError } from '../errors/index.js';
import type { EcollectConfig } from '../config.js';
import { BASE_URLS } from '../config.js';
import type {
  PaymentInfoItem,
  TokenCommand,
  TokenCommandRequest,
  TokenCommandResponse,
  QueryTokenRequest,
  QueryTokenResponse,
} from '../types/api.js';
import type { CardData, SavedCard } from '../types/index.js';
import type { HttpClient } from '../utils/http.js';
import type { SessionModule } from './session.js';
import { validateCardNumber, validateExpirationDate } from '../utils/validators.js';

function info(code: number, desc: string, value: string | number | undefined): PaymentInfoItem | null {
  if (value === undefined || value === null || value === '') return null;
  return { AttributeCode: code, AttributeDesc: desc, AttributeValue: String(value) };
}

function buildCardTokenInfoArray(card: CardData): PaymentInfoItem[] {
  const items: Array<PaymentInfoItem | null> = [
    info(0, 'CardNumber', card.cardNumber),
    info(2, 'PaymentSystem', card.paymentSystem),
    info(3, 'SecureCode', card.secureCode),
    info(4, 'ExpirationDate', card.expirationDate),
    info(6, 'Usermail', card.email),
    info(7, 'MobileCountryCode', card.mobileCountryCode),
    info(8, 'MobileNumber', card.mobileNumber),
    info(9, 'FiCode', card.fiCode),
    info(17, 'CardHolderName', card.cardHolderName),
    info(18, 'CardHolderIdType', card.cardHolderIdType),
    info(19, 'CardHolderId', card.cardHolderId),
    info(21, 'CardIssueBank', card.cardIssueBank),
    info(22, 'AccountType', card.accountType !== undefined ? String(card.accountType) : undefined),
    info(20, 'CardIssueCountry', card.cardIssueCountry),
  ];

  // CustomerId replaces cardholder details if present
  if (card.customerId) {
    items.push(info(100, 'CustomerId', card.customerId));
  }

  return items.filter((x): x is PaymentInfoItem => x !== null);
}

function mapTokenResponse(res: TokenCommandResponse): SavedCard {
  const arr = res.TokenInfoArray ?? [];
  const findAttr = (code: number) => arr.find((i) => i.AttributeCode === code)?.AttributeValue;

  return {
    tokenId: findAttr(1) ?? '',
    maskedCard: findAttr(12),
    last4: findAttr(11),
    paymentSystem: findAttr(2),
    fiCode: findAttr(9),
    fiName: findAttr(10),
    brandImageUrl: findAttr(13),
    requiresOneTimePassword: !!findAttr(25),
    lifetimeSecs: res.LifetimeSecs,
  };
}

export class TokensModule {
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

  private async _command(command: TokenCommand, tokenInfoArray: PaymentInfoItem[]): Promise<SavedCard> {
    const url = `${this.baseUrl}/tokenCommand`;
    const sessionToken = await this.session.getActive();

    const body: TokenCommandRequest = {
      EntityCode: this.config.etyCode,
      SessionToken: sessionToken,
      Command: command,
      TokenInfoArray: tokenInfoArray,
    };

    const res = await this.http.post<TokenCommandRequest, TokenCommandResponse>(url, body);

    if (res.ReturnCode === 'FAIL_APIEXPIREDSESSION') {
      this.session.invalidate();
      body.SessionToken = await this.session.getActive();
      const retried = await this.http.post<TokenCommandRequest, TokenCommandResponse>(url, body);
      if (retried.ReturnCode !== 'SUCCESS' && retried.ReturnCode !== 'SUCCESS_ALREADY_CREATED') {
        throw mapReturnCodeToError(retried.ReturnCode);
      }
      return mapTokenResponse(retried);
    }

    if (res.ReturnCode !== 'SUCCESS' && res.ReturnCode !== 'SUCCESS_ALREADY_CREATED') {
      throw mapReturnCodeToError(res.ReturnCode);
    }

    return mapTokenResponse(res);
  }

  /**
   * Save a card token persistently (SAVE command).
   */
  async save(cardData: CardData): Promise<SavedCard> {
    validateCardNumber(cardData.cardNumber);
    validateExpirationDate(cardData.expirationDate);
    return this._command('SAVE', buildCardTokenInfoArray(cardData));
  }

  /**
   * Get a temporary token without saving (GET command).
   */
  async get(cardData: CardData): Promise<SavedCard> {
    validateCardNumber(cardData.cardNumber);
    validateExpirationDate(cardData.expirationDate);
    return this._command('GET', buildCardTokenInfoArray(cardData));
  }

  /**
   * Get a hold token for pre-authorization (HOLD command).
   */
  async hold(cardData: CardData): Promise<SavedCard> {
    validateCardNumber(cardData.cardNumber);
    validateExpirationDate(cardData.expirationDate);
    return this._command('HOLD', buildCardTokenInfoArray(cardData));
  }

  /**
   * List saved cards for a user (queryToken).
   */
  async list(email: string, cardHolderId: string): Promise<SavedCard[]> {
    const url = `${this.baseUrl}/queryToken`;
    const sessionToken = await this.session.getActive();

    const tokenInfoArray: PaymentInfoItem[] = [
      { AttributeCode: 6, AttributeDesc: 'Usermail', AttributeValue: email },
      { AttributeCode: 19, AttributeDesc: 'CardHolderId', AttributeValue: cardHolderId },
    ];

    const body: QueryTokenRequest = {
      EntityCode: this.config.etyCode,
      SessionToken: sessionToken,
      TokenInfoArray: tokenInfoArray,
    };

    const res = await this.http.post<QueryTokenRequest, QueryTokenResponse>(url, body);

    if (res.ReturnCode === 'NO_RECORDS') return [];
    if (res.ReturnCode !== 'SUCCESS') {
      throw mapReturnCodeToError(res.ReturnCode);
    }

    return (res.TokenArray ?? []).map((record) => {
      const arr = record.TokenInfoArray ?? [];
      const findAttr = (code: number) => arr.find((i) => i.AttributeCode === code)?.AttributeValue;
      return {
        tokenId: findAttr(1) ?? '',
        maskedCard: findAttr(12),
        last4: findAttr(11),
        bin4: findAttr(30),
        paymentSystem: findAttr(2),
        fiCode: findAttr(9),
        fiName: findAttr(10),
        brandImageUrl: findAttr(13),
        email: findAttr(6),
        customerId: findAttr(100),
        tokenStatus: record.TokenStatus as SavedCard['tokenStatus'],
        lifetimeSecs: record.LifetimeSecs,
        requiresOneTimePassword: !!findAttr(25),
      };
    });
  }

  /**
   * Delete a saved card (REMOVE command).
   */
  async delete(
    tokenId: string,
    email: string,
    cardHolderId: string,
  ): Promise<void> {
    await this._command('REMOVE', [
      { AttributeCode: 1, AttributeDesc: 'TokenId', AttributeValue: tokenId },
      { AttributeCode: 6, AttributeDesc: 'Usermail', AttributeValue: email },
      { AttributeCode: 19, AttributeDesc: 'CardHolderId', AttributeValue: cardHolderId },
    ]);
  }

  /**
   * Update the expiration date of a saved card (UPDATE command).
   */
  async update(
    tokenId: string,
    newExpiry: string,
    cardHolderId?: string,
  ): Promise<SavedCard> {
    validateExpirationDate(newExpiry);
    const items: PaymentInfoItem[] = [
      { AttributeCode: 1, AttributeDesc: 'TokenId', AttributeValue: tokenId },
      { AttributeCode: 4, AttributeDesc: 'ExpirationDate', AttributeValue: newExpiry },
    ];
    if (cardHolderId) {
      items.push({ AttributeCode: 19, AttributeDesc: 'CardHolderId', AttributeValue: cardHolderId });
    }
    return this._command('UPDATE', items);
  }
}
