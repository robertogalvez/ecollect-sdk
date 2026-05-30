<?php

declare(strict_types=1);

namespace Ecollect\Exceptions;

class AuthenticationException extends EcollectException
{
    public function __construct(
        string $message = 'Authentication failed: merchant inactive or blocked',
        ?string $returnCode = null
    ) {
        parent::__construct($message, 'AUTHENTICATION_ERROR', $returnCode);
    }
}
