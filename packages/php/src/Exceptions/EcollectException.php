<?php

declare(strict_types=1);

namespace Ecollect\Exceptions;

use RuntimeException;

/**
 * Base exception for all ecollect SDK errors.
 */
class EcollectException extends RuntimeException
{
    /** @var string */
    private $code_str;

    /** @var string|null */
    private $returnCode;

    public function __construct(string $message, string $codeStr, ?string $returnCode = null)
    {
        parent::__construct($message);
        $this->code_str   = $codeStr;
        $this->returnCode = $returnCode;
    }

    public function getCodeStr(): string
    {
        return $this->code_str;
    }

    public function getReturnCode(): ?string
    {
        return $this->returnCode;
    }
}
