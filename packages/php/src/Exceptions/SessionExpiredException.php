<?php

declare(strict_types=1);

namespace Ecollect\Exceptions;

class SessionExpiredException extends EcollectException
{
    public function __construct(string $message = 'Session token has expired', ?string $returnCode = null)
    {
        parent::__construct($message, 'SESSION_EXPIRED', $returnCode);
    }
}
