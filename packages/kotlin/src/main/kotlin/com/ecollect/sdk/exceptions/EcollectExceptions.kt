package com.ecollect.sdk.exceptions

open class EcollectException(message: String, cause: Throwable? = null) : Exception(message, cause)

class SessionExpiredException(message: String) : EcollectException(message)
class InvalidConfigException(message: String) : EcollectException(message)
class ValidationException(message: String) : EcollectException(message)
class InvalidCardException(message: String) : EcollectException(message)
class NetworkRetryableException(message: String, cause: Throwable? = null) : EcollectException(message, cause)
class TokenNotFoundException(message: String) : EcollectException(message)
class DuplicateTransactionException(message: String) : EcollectException(message)
class AuthenticationException(message: String) : EcollectException(message)
class WebhookValidationException(message: String) : EcollectException(message)
class PollingTimeoutException(message: String) : EcollectException(message)
class CustomerNotFoundException(message: String) : EcollectException(message)
