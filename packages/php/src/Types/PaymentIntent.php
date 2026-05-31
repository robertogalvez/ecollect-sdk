<?php

declare(strict_types=1);

namespace Ecollect\Types;

/**
 * Represents a payment intention with all transaction parameters.
 */
class PaymentIntent
{
    /** @var float */
    public $amount;

    /** @var string ISO 4217 currency code */
    public $currency;

    /** @var Customer */
    public $customer;

    /** @var int|null */
    public $srvCode;

    /** @var string|null */
    public $merchantTransactionId;

    /** @var string|null */
    public $paymentSystem;

    /** @var string|null */
    public $fiCode;

    /** @var string|null */
    public $tokenId;

    /** @var string|null */
    public $secureCode;

    /** @var int|null */
    public $installments;

    /** @var float|null */
    public $vatAmount;

    /** @var string|null */
    public $redirectUrl;

    /** @var string|null */
    public $responseUrl;

    /** @var string|null */
    public $langCode;

    /** @var string|null */
    public $invoice;

    /** @var string|null yyyyMMddHHmmss format */
    public $invoiceDueDate;

    /** @var string|null */
    public $policyCode;

    /** @var string|null */
    public $ipAddress;

    /** @var string|null */
    public $deviceFingerPrint;

    /** @var string|null */
    public $oneTimePassword;

    /** @var string|null '0' or '1' for PSE (Colombia) */
    public $userType;

    /** @var string[]|null */
    public $additionalReferences;

    /** @var int|null Lifetime in seconds for QR payment links */
    public $qrLifetimeSecs;

    /** @var array<int, array{entityCode: int, srvCode: int, valueType: int, transValue: float, transVatValue?: float}>|null */
    public $subservices;

    /** @var array<string, string>|null Extra payment info key=>value pairs */
    public $paymentInfo;

    /**
     * @param array<string, mixed> $data
     */
    public function __construct(array $data = [])
    {
        $this->amount                = (float)($data['amount']                  ?? 0);
        $this->currency              = $data['currency']                         ?? '';
        $this->customer              = $data['customer'] instanceof Customer
            ? $data['customer']
            : new Customer($data['customer'] ?? []);
        $this->srvCode               = isset($data['srv_code'])               ? (int)$data['srv_code']               : null;
        $this->merchantTransactionId = $data['merchant_transaction_id']        ?? null;
        $this->paymentSystem         = isset($data['payment_system'])          ? (string)$data['payment_system']     : null;
        $this->fiCode                = $data['fi_code']                         ?? null;
        $this->tokenId               = $data['token_id']                        ?? null;
        $this->secureCode            = $data['secure_code']                     ?? null;
        $this->installments          = isset($data['installments'])             ? (int)$data['installments']          : null;
        $this->vatAmount             = isset($data['vat_amount'])               ? (float)$data['vat_amount']          : null;
        $this->redirectUrl           = $data['redirect_url']                    ?? null;
        $this->responseUrl           = $data['response_url']                    ?? null;
        $this->langCode              = $data['lang_code']                       ?? null;
        $this->invoice               = $data['invoice']                         ?? null;
        $this->invoiceDueDate        = $data['invoice_due_date']                ?? null;
        $this->policyCode            = $data['policy_code']                     ?? null;
        $this->ipAddress             = $data['ip_address']                      ?? null;
        $this->deviceFingerPrint     = $data['device_finger_print']             ?? null;
        $this->oneTimePassword       = $data['one_time_password']               ?? null;
        $this->userType              = isset($data['user_type'])                ? (string)$data['user_type']          : null;
        $this->additionalReferences  = $data['additional_references']           ?? null;
        $this->qrLifetimeSecs        = isset($data['qr_lifetime_secs'])        ? (int)$data['qr_lifetime_secs']     : null;
        $this->subservices           = $data['subservices']                     ?? null;
        $this->paymentInfo           = $data['payment_info']                    ?? null;
    }
}
