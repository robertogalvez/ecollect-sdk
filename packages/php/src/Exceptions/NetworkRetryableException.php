<?php

declare(strict_types=1);

namespace Ecollect\Exceptions;

class NetworkRetryableException extends EcollectException
{
    public function __construct(
        string $message = 'Temporary system error. The SDK will retry automatically.',
        ?string $returnCode = null
    ) {
        parent::__construct($message, 'NETWORK_RETRYABLE', $returnCode);
    }
}
