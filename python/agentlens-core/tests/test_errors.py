"""Tests for error classes."""

import pytest

from agentlens_core.errors import (
    AgentLensError,
    ContextError,
    InterceptorError,
    SchemaValidationError,
    TransportError,
)


class TestAgentLensError:
    """Test base AgentLensError class."""

    def test_create_agentlens_error(self) -> None:
        """Create AgentLensError with message, code, and recoverable."""
        error = AgentLensError(
            "Test error",
            code="TEST_ERROR",
            recoverable=True,
        )

        assert isinstance(error, Exception)
        assert error.message == "Test error"
        assert error.code == "TEST_ERROR"
        assert error.recoverable is True

    def test_agentlens_error_str(self) -> None:
        """AgentLensError string representation."""
        error = AgentLensError("Test error", "TEST")
        assert str(error) == "Test error"


class TestSchemaValidationError:
    """Test SchemaValidationError."""

    def test_create_schema_validation_error(self) -> None:
        """Create SchemaValidationError."""
        error = SchemaValidationError("Invalid schema")

        assert isinstance(error, AgentLensError)
        assert error.message == "Invalid schema"
        assert error.code == "SCHEMA_VALIDATION_ERROR"
        assert error.recoverable is False

    def test_raise_schema_validation_error(self) -> None:
        """Can raise and catch SchemaValidationError."""
        with pytest.raises(SchemaValidationError):
            raise SchemaValidationError("Invalid event")


class TestTransportError:
    """Test TransportError."""

    def test_create_transport_error_recoverable(self) -> None:
        """Create recoverable TransportError."""
        error = TransportError("Write failed", recoverable=True)

        assert isinstance(error, AgentLensError)
        assert error.code == "TRANSPORT_ERROR"
        assert error.recoverable is True

    def test_create_transport_error_not_recoverable(self) -> None:
        """Create non-recoverable TransportError."""
        error = TransportError("Write failed", recoverable=False)

        assert error.recoverable is False


class TestContextError:
    """Test ContextError."""

    def test_create_context_error(self) -> None:
        """Create ContextError."""
        error = ContextError("No active context")

        assert isinstance(error, AgentLensError)
        assert error.message == "No active context"
        assert error.code == "CONTEXT_ERROR"
        assert error.recoverable is False

    def test_raise_context_error(self) -> None:
        """Can raise and catch ContextError."""
        with pytest.raises(ContextError):
            raise ContextError("Context missing")


class TestInterceptorError:
    """Test InterceptorError."""

    def test_create_interceptor_error(self) -> None:
        """Create InterceptorError."""
        error = InterceptorError("Failed to wrap client")

        assert isinstance(error, AgentLensError)
        assert error.code == "INTERCEPTOR_ERROR"
        assert error.recoverable is False

    def test_raise_interceptor_error(self) -> None:
        """Can raise and catch InterceptorError."""
        with pytest.raises(InterceptorError):
            raise InterceptorError("Incompatible SDK version")


class TestErrorHierarchy:
    """Test error class hierarchy."""

    def test_all_custom_errors_inherit_from_agentlens_error(self) -> None:
        """All custom errors inherit from AgentLensError."""
        errors = [
            SchemaValidationError("test"),
            TransportError("test"),
            ContextError("test"),
            InterceptorError("test"),
        ]

        for error in errors:
            assert isinstance(error, AgentLensError)
            assert isinstance(error, Exception)

    def test_error_attributes_accessible(self) -> None:
        """Error attributes (message, code, recoverable) are accessible."""
        error = TransportError("File not found", recoverable=True)

        assert hasattr(error, "message")
        assert hasattr(error, "code")
        assert hasattr(error, "recoverable")
