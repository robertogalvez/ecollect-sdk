<?php

declare(strict_types=1);

namespace Ecollect\Exceptions;

class TokenNotFoundException extends EcollectException
{
    public function __construct(
        string $message = 'Token not found or does not match creation data',
        ?string $returnCode = null
    ) {
        parent::__construct($message, 'TOKEN_NOT_FOUND', $returnCode);
    }
}
