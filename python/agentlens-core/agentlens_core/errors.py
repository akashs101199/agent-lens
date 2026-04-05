"""
Typed error classes for AgentLens.

All errors inherit from AgentLensError and provide structured error information.
"""


class AgentLensError(Exception):
    """
    Base exception class for all AgentLens errors.

    Args:
        message: Human-readable error message
        code: Machine-readable error code (e.g., 'CONTEXT_MISSING')
        recoverable: Whether the error can be recovered from
    """

    def __init__(
        self,
        message: str,
        code: str,
        recoverable: bool = True,
    ) -> None:
        """Initialize AgentLensError."""
        super().__init__(message)
        self.message = message
        self.code = code
        self.recoverable = recoverable


class SchemaValidationError(AgentLensError):
    """Raised when an event fails ARLS schema validation."""

    def __init__(self, message: str) -> None:
        """Initialize SchemaValidationError."""
        super().__init__(message, "SCHEMA_VALIDATION_ERROR", recoverable=False)


class TransportError(AgentLensError):
    """Raised when a transport write fails."""

    def __init__(self, message: str, recoverable: bool = True) -> None:
        """Initialize TransportError."""
        super().__init__(message, "TRANSPORT_ERROR", recoverable=recoverable)


class ContextError(AgentLensError):
    """Raised when context operations fail (missing run context, etc)."""

    def __init__(self, message: str) -> None:
        """Initialize ContextError."""
        super().__init__(message, "CONTEXT_ERROR", recoverable=False)


class InterceptorError(AgentLensError):
    """Raised when an interceptor fails to wrap a function or client."""

    def __init__(self, message: str) -> None:
        """Initialize InterceptorError."""
        super().__init__(message, "INTERCEPTOR_ERROR", recoverable=False)
