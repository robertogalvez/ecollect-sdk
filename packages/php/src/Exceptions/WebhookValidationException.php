<?php

declare(strict_types=1);

namespace Ecollect\Exceptions;

class WebhookValidationException extends EcollectException
{
    public function __construct(string $message, ?string $returnCode = null)
    {
        parent::__construct($message, 'WEBHOOK_VALIDATION', $returnCode);
    }
}
