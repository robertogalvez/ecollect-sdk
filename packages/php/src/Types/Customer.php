<?php

declare(strict_types=1);

namespace Ecollect\Types;

/**
 * Customer / payer information.
 */
class Customer
{
    /** @var string */
    public $email;

    /** @var string */
    public $fullName;

    /** @var string|null */
    public $documentType;

    /** @var string|null */
    public $documentNumber;

    /** @var string|null */
    public $phone;

    /** @var string|null */
    public $mobileCountryCode;

    /** @var string|null */
    public $mobileNumber;

    /**
     * @param array<string, mixed> $data
     */
    public function __construct(array $data = [])
    {
        $this->email             = $data['email']               ?? '';
        $this->fullName          = $data['full_name']           ?? '';
        $this->documentType      = $data['document_type']       ?? null;
        $this->documentNumber    = $data['document_number']     ?? null;
        $this->phone             = $data['phone']               ?? null;
        $this->mobileCountryCode = $data['mobile_country_code'] ?? null;
        $this->mobileNumber      = $data['mobile_number']       ?? null;
    }
}
