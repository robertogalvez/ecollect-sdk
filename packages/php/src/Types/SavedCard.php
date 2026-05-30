<?php

declare(strict_types=1);

namespace Ecollect\Types;

/**
 * Represents a saved/tokenised card returned from ecollect.
 */
class SavedCard
{
    /** @var string */
    public $tokenId;

    /** @var string|null */
    public $maskedCard;

    /** @var string|null */
    public $last4;

    /** @var string|null */
    public $bin4;

    /** @var string|null */
    public $paymentSystem;

    /** @var string|null */
    public $fiCode;

    /** @var string|null */
    public $fiName;

    /** @var string|null */
    public $brandImageUrl;

    /** @var string|null */
    public $email;

    /** @var string|null */
    public $customerId;

    /** @var string|null 'ACTIVE'|'VERIFY'|'EXPIRED' */
    public $tokenStatus;

    /** @var int|null */
    public $lifetimeSecs;

    /** @var bool */
    public $requiresOneTimePassword;

    /**
     * @param array<string, mixed> $data
     */
    public function __construct(array $data = [])
    {
        $this->tokenId                 = $data['token_id']                   ?? '';
        $this->maskedCard              = $data['masked_card']                ?? null;
        $this->last4                   = $data['last4']                      ?? null;
        $this->bin4                    = $data['bin4']                       ?? null;
        $this->paymentSystem           = $data['payment_system']             ?? null;
        $this->fiCode                  = $data['fi_code']                    ?? null;
        $this->fiName                  = $data['fi_name']                    ?? null;
        $this->brandImageUrl           = $data['brand_image_url']            ?? null;
        $this->email                   = $data['email']                      ?? null;
        $this->customerId              = $data['customer_id']                ?? null;
        $this->tokenStatus             = $data['token_status']               ?? null;
        $this->lifetimeSecs            = isset($data['lifetime_secs'])       ? (int)$data['lifetime_secs'] : null;
        $this->requiresOneTimePassword = (bool)($data['requires_otp']       ?? false);
    }
}
