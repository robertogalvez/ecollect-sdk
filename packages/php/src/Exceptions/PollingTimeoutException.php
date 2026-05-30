<?php

declare(strict_types=1);

namespace Ecollect\Exceptions;

class PollingTimeoutException extends EcollectException
{
    /** @var int */
    private $ticketId;

    public function __construct(int $ticketId, ?string $message = null)
    {
        $this->ticketId = $ticketId;
        parent::__construct(
            $message ?? "Polling timeout exceeded for ticket {$ticketId}",
            'POLLING_TIMEOUT'
        );
    }

    public function getTicketId(): int
    {
        return $this->ticketId;
    }
}
