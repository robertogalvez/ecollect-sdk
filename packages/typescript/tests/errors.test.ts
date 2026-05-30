import {
  EcollectError,
  SessionExpiredException,
  InvalidConfigException,
  ValidationException,
  InvalidCardException,
  NetworkRetryableException,
  TokenNotFoundException,
  DuplicateTransactionException,
  AuthenticationException,
  WebhookValidationException,
  CustomerException,
  PollingTimeoutException,
  mapReturnCodeToError,
} from '../src/errors/index';

describe('Error hierarchy', () => {
  it('all errors extend EcollectError', () => {
    expect(new SessionExpiredException()).toBeInstanceOf(EcollectError);
    expect(new InvalidConfigException('test')).toBeInstanceOf(EcollectError);
    expect(new ValidationException('test')).toBeInstanceOf(EcollectError);
    expect(new InvalidCardException('test')).toBeInstanceOf(EcollectError);
    expect(new NetworkRetryableException()).toBeInstanceOf(EcollectError);
    expect(new TokenNotFoundException()).toBeInstanceOf(EcollectError);
    expect(new DuplicateTransactionException()).toBeInstanceOf(EcollectError);
    expect(new AuthenticationException()).toBeInstanceOf(EcollectError);
    expect(new WebhookValidationException('test')).toBeInstanceOf(EcollectError);
    expect(new CustomerException('test')).toBeInstanceOf(EcollectError);
    expect(new PollingTimeoutException('123')).toBeInstanceOf(EcollectError);
  });

  it('all errors extend Error', () => {
    expect(new SessionExpiredException()).toBeInstanceOf(Error);
  });

  it('EcollectError has correct name', () => {
    const err = new SessionExpiredException('test');
    expect(err.name).toBe('SessionExpiredException');
  });

  it('NetworkRetryableException has isRetryable=true', () => {
    const err = new NetworkRetryableException();
    expect(err.isRetryable).toBe(true);
  });

  it('PollingTimeoutException stores ticketId', () => {
    const err = new PollingTimeoutException('ticket_999');
    expect(err.ticketId).toBe('ticket_999');
  });
});

describe('mapReturnCodeToError', () => {
  const cases: Array<[string, abstract new (...args: never[]) => EcollectError]> = [
    ['FAIL_APIEXPIREDSESSION', SessionExpiredException],
    ['FAIL_INVALIDENTITYCODE', InvalidConfigException],
    ['FAIL_INVALIDSERVICECODE', InvalidConfigException],
    ['FAIL_INVALIDREFERENCE1', ValidationException],
    ['FAIL_INVALIDTRANSVALUE', ValidationException],
    ['FAIL_INVALIDVATVALUE', ValidationException],
    ['FAIL_INVALIDCURRENCY', ValidationException],
    ['FAIL_INVALIDCREDITCARD', InvalidCardException],
    ['FAIL_INVALIDEXPIRATIONDATE', InvalidCardException],
    ['FAIL_TOKENNOTFOUND', TokenNotFoundException],
    ['FAIL_MERCHANTRANSID', DuplicateTransactionException],
    ['FAIL_ACCESSDENIED', AuthenticationException],
    ['FAIL_SESSIONNOTFOUND', WebhookValidationException],
    ['FAIL_TICKETIDNOTMATCH', WebhookValidationException],
    ['FAIL_SYSTEM', NetworkRetryableException],
    ['FAIL_CUSTOMERNOTFOUND', EcollectError],
    ['FAIL_USERMISMATCH', EcollectError],
    ['FAIL_CARDHOLDERIDTYPE', ValidationException],
    ['FAIL_MAILFORMAT', ValidationException],
  ];

  test.each(cases)('%s maps to correct exception type', (code, ExpectedClass) => {
    const err = mapReturnCodeToError(code);
    expect(err).toBeInstanceOf(ExpectedClass);
  });

  it('stores returnCode on error', () => {
    const err = mapReturnCodeToError('FAIL_SYSTEM');
    expect(err.returnCode).toBe('FAIL_SYSTEM');
  });

  it('handles unknown codes gracefully', () => {
    const err = mapReturnCodeToError('UNKNOWN_CODE_XYZ');
    expect(err).toBeInstanceOf(EcollectError);
    expect(err.message).toContain('UNKNOWN_CODE_XYZ');
  });
});
