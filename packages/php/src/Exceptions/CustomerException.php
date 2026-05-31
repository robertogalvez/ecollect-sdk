<?php

declare(strict_types=1);

namespace Ecollect\Exceptions;

class CustomerException extends EcollectException
{
    public function __construct(string $message, ?string $returnCode = null)
    {
        parent::__construct($message, 'CUSTOMER_ERROR', $returnCode);
    }
}
