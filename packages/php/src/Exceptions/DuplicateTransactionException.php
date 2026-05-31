<?php

declare(strict_types=1);

namespace Ecollect\Exceptions;

class DuplicateTransactionException extends EcollectException
{
    public function __construct(
        string $message = 'MerchantTransactionId already assigned to another transaction',
        ?string $returnCode = null
    ) {
        parent::__construct($message, 'DUPLICATE_TRANSACTION', $returnCode);
    }
}
