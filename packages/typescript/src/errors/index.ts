/**
 * ecollect SDK Error Hierarchy
 */

export class EcollectError extends Error {
  public readonly code: string;
  public readonly returnCode?: string;

  constructor(message: string, code: string, returnCode?: string) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.returnCode = returnCode;
    // Maintain proper stack trace in V8
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

export class SessionExpiredException extends EcollectError {
  constructor(message = 'Session token has expired', returnCode?: string) {
    super(message, 'SESSION_EXPIRED', returnCode);
  }
}

export class InvalidConfigException extends EcollectError {
  constructor(message: string, returnCode?: string) {
    super(message, 'INVALID_CONFIG', returnCode);
  }
}

export class ValidationException extends EcollectError {
  constructor(message: string, returnCode?: string) {
    super(message, 'VALIDATION_ERROR', returnCode);
  }
}

export class InvalidCardException extends EcollectError {
  constructor(message: string, returnCode?: string) {
    super(message, 'INVALID_CARD', returnCode);
  }
}

export class InsufficientFundsException extends EcollectError {
  constructor(message = 'Insufficient funds', returnCode?: string) {
    super(message, 'INSUFFICIENT_FUNDS', returnCode);
  }
}

export class NetworkRetryableException extends EcollectError {
  public readonly isRetryable = true;

  constructor(message = 'Temporary system error. The SDK will retry automatically.', returnCode?: string) {
    super(message, 'NETWORK_RETRYABLE', returnCode);
  }
}

export class TokenNotFoundException extends EcollectError {
  constructor(message = 'Token not found or does not match creation data', returnCode?: string) {
    super(message, 'TOKEN_NOT_FOUND', returnCode);
  }
}

export class TokenExpiredException extends EcollectError {
  constructor(message = 'Token expired: card expiration date has passed', returnCode?: string) {
    super(message, 'TOKEN_EXPIRED', returnCode);
  }
}

export class TokenValidationException extends EcollectError {
  constructor(message = 'Required token fields are missing', returnCode?: string) {
    super(message, 'TOKEN_VALIDATION', returnCode);
  }
}

export class DuplicateTransactionException extends EcollectError {
  constructor(message = 'MerchantTransactionId already assigned to another transaction', returnCode?: string) {
    super(message, 'DUPLICATE_TRANSACTION', returnCode);
  }
}

export class DuplicateInvoiceException extends EcollectError {
  constructor(message = 'Invoice already exists in another transaction', returnCode?: string) {
    super(message, 'DUPLICATE_INVOICE', returnCode);
  }
}

export class AuthenticationException extends EcollectError {
  constructor(message = 'Authentication failed: merchant inactive or blocked', returnCode?: string) {
    super(message, 'AUTHENTICATION_ERROR', returnCode);
  }
}

export class WebhookValidationException extends EcollectError {
  constructor(message: string, returnCode?: string) {
    super(message, 'WEBHOOK_VALIDATION', returnCode);
  }
}

export class CustomerException extends EcollectError {
  constructor(message: string, returnCode?: string) {
    super(message, 'CUSTOMER_ERROR', returnCode);
  }
}

export class CustomerNotFoundException extends EcollectError {
  constructor(message = 'CustomerId not found', returnCode?: string) {
    super(message, 'CUSTOMER_NOT_FOUND', returnCode);
  }
}

export class CardMismatchException extends EcollectError {
  constructor(message = 'Card already tokenized under a different user', returnCode?: string) {
    super(message, 'CARD_MISMATCH', returnCode);
  }
}

export class TicketNotFoundException extends EcollectError {
  constructor(message = 'TicketId not found', returnCode?: string) {
    super(message, 'TICKET_NOT_FOUND', returnCode);
  }
}

export class PollingTimeoutException extends EcollectError {
  public readonly ticketId: string;

  constructor(ticketId: string, message?: string) {
    super(message ?? `Polling timeout exceeded for ticket ${ticketId}`, 'POLLING_TIMEOUT');
    this.ticketId = ticketId;
  }
}

export class PolicyConfigException extends EcollectError {
  constructor(message = 'PolicyCode is invalid or not configured', returnCode?: string) {
    super(message, 'POLICY_CONFIG', returnCode);
  }
}

/**
 * Map ecollect ReturnCode to SDK exception
 */
export function mapReturnCodeToError(returnCode: string, message?: string): EcollectError {
  const defaultMsg = message ?? returnCode;

  switch (returnCode) {
    case 'FAIL_APIEXPIREDSESSION':
      return new SessionExpiredException('Session token has expired', returnCode);

    case 'FAIL_INVALIDENTITYCODE':
      return new InvalidConfigException(`EtyCode invalid or does not exist: ${defaultMsg}`, returnCode);

    case 'FAIL_INVALIDSERVICECODE':
      return new InvalidConfigException(`SrvCode invalid or does not exist: ${defaultMsg}`, returnCode);

    case 'FAIL_INVALIDPOLICY':
      return new PolicyConfigException(defaultMsg, returnCode);

    case 'FAIL_INVALIDREFERENCE1':
      return new ValidationException('ReferenceArray must contain at least one reference', returnCode);

    case 'FAIL_INVALIDTRANSVALUE':
      return new ValidationException('TransValue is invalid (must be > 0)', returnCode);

    case 'FAIL_INVALIDVATVALUE':
      return new ValidationException('TransVatValue is invalid', returnCode);

    case 'FAIL_INVALIDCURRENCY':
      return new ValidationException('SrvCurrency is invalid or not allowed', returnCode);

    case 'FAIL_INVALIDINVOICE':
      return new DuplicateInvoiceException(defaultMsg, returnCode);

    case 'FAIL_INVALIDSUBSERVICEARRAY':
      return new ValidationException('SubservicesArray: dispersion validation failed', returnCode);

    case 'FAIL_TOKENNOTFOUND':
      return new TokenNotFoundException(defaultMsg, returnCode);

    case 'FAIL_TOKENEXPIRED':
      return new TokenExpiredException(defaultMsg, returnCode);

    case 'FAIL_TOKENREQUEST':
      return new TokenValidationException(defaultMsg, returnCode);

    case 'FAIL_MERCHANTRANSID':
      return new DuplicateTransactionException(defaultMsg, returnCode);

    case 'FAIL_INVALIDCREDITCARD':
      return new InvalidCardException('Card number is invalid (Luhn check failed)', returnCode);

    case 'FAIL_INVALIDEXPIRATIONDATE':
      return new InvalidCardException('Expiration date is invalid or card has expired', returnCode);

    case 'FAIL_INVALIDACCOUNTTYPE':
      return new ValidationException('AccountType is invalid', returnCode);

    case 'FAIL_CARDHOLDERIDTYPE':
      return new ValidationException('CardHolderIdType does not match allowed codes for this country', returnCode);

    case 'FAIL_CARDHOLDERID':
      return new ValidationException('CardHolderId is invalid', returnCode);

    case 'FAIL_CARDHOLDERNAME':
      return new ValidationException('CardHolderName is invalid', returnCode);

    case 'FAIL_MOBILECOUNTRYCODE':
      return new ValidationException('MobileCountryCode is invalid', returnCode);

    case 'FAIL_MOBILENUMBER':
      return new ValidationException('MobileNumber is invalid', returnCode);

    case 'FAIL_MAILFORMAT':
      return new ValidationException('Usermail is invalid or malformed', returnCode);

    case 'FAIL_USERMISMATCH':
      return new CardMismatchException(defaultMsg, returnCode);

    case 'FAIL_CUSTOMERNOTFOUND':
      return new CustomerNotFoundException(defaultMsg, returnCode);

    case 'FAIL_INVALIDTICKETID':
      return new TicketNotFoundException(defaultMsg, returnCode);

    case 'FAIL_ACCESSDENIED':
      return new AuthenticationException(defaultMsg, returnCode);

    case 'FAIL_SESSIONNOTFOUND':
      return new WebhookValidationException('SessionToken to verify does not exist', returnCode);

    case 'FAIL_TICKETIDNOTMATCH':
      return new WebhookValidationException('TicketId does not match the SessionToken', returnCode);

    case 'FAIL_INVALIDCOMMAND':
      return new ValidationException('Token command is invalid', returnCode);

    case 'FAIL_SYSTEM':
      return new NetworkRetryableException('Temporary system error in ecollect. Retrying...', returnCode);

    default:
      return new EcollectError(`ecollect error: ${defaultMsg}`, returnCode, returnCode);
  }
}
