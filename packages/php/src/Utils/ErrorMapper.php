<?php

declare(strict_types=1);

namespace Ecollect\Utils;

use Ecollect\Exceptions\AuthenticationException;
use Ecollect\Exceptions\CustomerException;
use Ecollect\Exceptions\DuplicateTransactionException;
use Ecollect\Exceptions\EcollectException;
use Ecollect\Exceptions\InvalidCardException;
use Ecollect\Exceptions\InvalidConfigException;
use Ecollect\Exceptions\NetworkRetryableException;
use Ecollect\Exceptions\SessionExpiredException;
use Ecollect\Exceptions\TokenNotFoundException;
use Ecollect\Exceptions\ValidationException;
use Ecollect\Exceptions\WebhookValidationException;

/**
 * Maps ecollect ReturnCode values to SDK exceptions.
 */
class ErrorMapper
{
    public static function map(string $returnCode, ?string $message = null): EcollectException
    {
        $msg = $message ?? $returnCode;

        switch ($returnCode) {
            case 'FAIL_APIEXPIREDSESSION':
                return new SessionExpiredException('Session token has expired', $returnCode);

            case 'FAIL_INVALIDENTITYCODE':
                return new InvalidConfigException("EtyCode invalid or does not exist: {$msg}", $returnCode);

            case 'FAIL_INVALIDSERVICECODE':
                return new InvalidConfigException("SrvCode invalid or does not exist: {$msg}", $returnCode);

            case 'FAIL_INVALIDREFERENCE1':
                return new ValidationException('ReferenceArray must contain at least one reference', $returnCode);

            case 'FAIL_INVALIDTRANSVALUE':
                return new ValidationException('TransValue is invalid (must be > 0)', $returnCode);

            case 'FAIL_INVALIDVATVALUE':
                return new ValidationException('TransVatValue is invalid', $returnCode);

            case 'FAIL_INVALIDCURRENCY':
                return new ValidationException('SrvCurrency is invalid or not allowed', $returnCode);

            case 'FAIL_INVALIDSUBSERVICEARRAY':
                return new ValidationException('SubservicesArray: dispersion validation failed', $returnCode);

            case 'FAIL_TOKENNOTFOUND':
            case 'FAIL_TOKENEXPIRED':
                return new TokenNotFoundException($msg, $returnCode);

            case 'FAIL_TOKENREQUEST':
                return new ValidationException('Required token fields are missing', $returnCode);

            case 'FAIL_MERCHANTRANSID':
                return new DuplicateTransactionException($msg, $returnCode);

            case 'FAIL_INVALIDCREDITCARD':
                return new InvalidCardException('Card number is invalid (Luhn check failed)', $returnCode);

            case 'FAIL_INVALIDEXPIRATIONDATE':
                return new InvalidCardException('Expiration date is invalid or card has expired', $returnCode);

            case 'FAIL_INVALIDACCOUNTTYPE':
                return new ValidationException('AccountType is invalid', $returnCode);

            case 'FAIL_CARDHOLDERIDTYPE':
                return new ValidationException('CardHolderIdType does not match allowed codes for this country', $returnCode);

            case 'FAIL_CARDHOLDERID':
                return new ValidationException('CardHolderId is invalid', $returnCode);

            case 'FAIL_CARDHOLDERNAME':
                return new ValidationException('CardHolderName is invalid', $returnCode);

            case 'FAIL_MOBILECOUNTRYCODE':
                return new ValidationException('MobileCountryCode is invalid', $returnCode);

            case 'FAIL_MOBILENUMBER':
                return new ValidationException('MobileNumber is invalid', $returnCode);

            case 'FAIL_MAILFORMAT':
                return new ValidationException('Usermail is invalid or malformed', $returnCode);

            case 'FAIL_USERMISMATCH':
                return new CustomerException($msg, $returnCode);

            case 'FAIL_CUSTOMERNOTFOUND':
                return new CustomerException($msg, $returnCode);

            case 'FAIL_INVALIDTICKETID':
                return new ValidationException("TicketId not found: {$msg}", $returnCode);

            case 'FAIL_ACCESSDENIED':
                return new AuthenticationException($msg, $returnCode);

            case 'FAIL_SESSIONNOTFOUND':
                return new WebhookValidationException('SessionToken to verify does not exist', $returnCode);

            case 'FAIL_TICKETIDNOTMATCH':
                return new WebhookValidationException('TicketId does not match the SessionToken', $returnCode);

            case 'FAIL_INVALIDCOMMAND':
                return new ValidationException('Token command is invalid', $returnCode);

            case 'FAIL_SYSTEM':
                return new NetworkRetryableException('Temporary system error in ecollect. Retrying...', $returnCode);

            default:
                return new EcollectException("ecollect error: {$msg}", $returnCode, $returnCode);
        }
    }
}
