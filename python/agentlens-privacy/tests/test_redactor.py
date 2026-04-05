"""Tests for PII redactor."""

import pytest

from agentlens_core import (
    ARLSEvent,
    SchemaType,
    AgentContext,
    AgentPhase,
    PrivacyData,
    ToolCallData,
    CallStatus,
    RedactionMode,
)
from agentlens_privacy.redactor import (
    redact_string,
    redact_object,
    redact_event,
)


class TestRedactString:
    """Test string redaction."""

    def test_redact_email_mask_mode(self) -> None:
        """Redact email with MASK mode."""
        result = redact_string(
            "Email: john@example.com",
            RedactionMode.MASK,
        )
        assert "[REDACTED]" in result.redacted
        assert "john@example.com" not in result.redacted
        assert len(result.detections) == 1

    def test_redact_email_hash_mode(self) -> None:
        """Redact email with HASH mode."""
        result = redact_string(
            "Email: test@example.com",
            RedactionMode.HASH,
        )
        assert "[sha256:" in result.redacted
        assert "]" in result.redacted
        assert "test@example.com" not in result.redacted

    def test_redact_email_drop_mode(self) -> None:
        """Redact email with DROP mode."""
        result = redact_string(
            "Contact: test@example.com here",
            RedactionMode.DROP,
        )
        assert "test@example.com" not in result.redacted
        assert "Contact:  here" in result.redacted

    def test_redact_email_placeholder_mode(self) -> None:
        """Redact email with PLACEHOLDER mode."""
        result = redact_string(
            "Email: test@example.com",
            RedactionMode.PLACEHOLDER,
        )
        assert "[EMAIL]" in result.redacted
        assert "test@example.com" not in result.redacted

    def test_redact_preserves_non_pii(self) -> None:
        """Redaction preserves non-PII text."""
        text = "Name: Alice, Age: 30"
        result = redact_string(text, RedactionMode.MASK)
        assert "Name: Alice" in result.redacted
        assert "Age: 30" in result.redacted

    def test_redact_no_pii(self) -> None:
        """Text with no PII is unchanged."""
        text = "Hello world, this is safe text"
        result = redact_string(text, RedactionMode.MASK)
        assert result.redacted == text
        assert len(result.detections) == 0

    def test_redact_multiple_detections(self) -> None:
        """Redact multiple PII in same string."""
        text = "Email: john@example.com, Phone: 555-123-4567"
        result = redact_string(text, RedactionMode.MASK)
        assert "john@example.com" not in result.redacted
        assert "555-123-4567" not in result.redacted
        assert result.redacted.count("[REDACTED]") >= 2


class TestRedactObject:
    """Test object redaction."""

    def test_redact_dict_with_email(self) -> None:
        """Redact email in dictionary."""
        obj = {"name": "Alice", "email": "alice@example.com"}
        redacted, fields = redact_object(obj, RedactionMode.MASK)

        assert redacted["name"] == "Alice"
        assert "[REDACTED]" in redacted["email"]
        assert "email" in str(fields)

    def test_redact_nested_dict(self) -> None:
        """Redact PII in nested dictionary."""
        obj = {
            "user": {
                "name": "Bob",
                "contact": {
                    "email": "bob@example.com",
                    "phone": "555-123-4567",
                },
            }
        }
        redacted, fields = redact_object(obj, RedactionMode.MASK)

        assert redacted["user"]["name"] == "Bob"
        assert "[REDACTED]" in redacted["user"]["contact"]["email"]
        assert "[REDACTED]" in redacted["user"]["contact"]["phone"]

    def test_redact_list(self) -> None:
        """Redact PII in list."""
        obj = ["alice@example.com", "bob@example.com"]
        redacted, fields = redact_object(obj, RedactionMode.MASK)

        assert "[REDACTED]" in redacted[0]
        assert "[REDACTED]" in redacted[1]

    def test_redact_mixed_types(self) -> None:
        """Redact mixed types (strings, numbers, etc)."""
        obj = {
            "email": "test@example.com",
            "age": 30,
            "active": True,
            "score": 95.5,
        }
        redacted, fields = redact_object(obj, RedactionMode.MASK)

        assert "[REDACTED]" in redacted["email"]
        assert redacted["age"] == 30
        assert redacted["active"] is True
        assert redacted["score"] == 95.5

    def test_redact_empty_object(self) -> None:
        """Redact empty dict."""
        obj: dict = {}
        redacted, fields = redact_object(obj, RedactionMode.MASK)

        assert redacted == {}
        assert len(fields) == 0


class TestRedactEvent:
    """Test ARLS event redaction."""

    def test_redact_tool_input(self) -> None:
        """Redact PII in tool input."""
        event = ARLSEvent(
            agentlens_version="1.0",
            schema_type=SchemaType.TOOL_CALL,
            timestamp="2025-01-01T00:00:00Z",
            trace_id="trace_123",
            run_id="run_123",
            step_index=1,
            agent=AgentContext(name="TestAgent", phase=AgentPhase.PLAN),
            privacy=PrivacyData(pii_detected=False),
            tool=ToolCallData(
                name="send_email",
                input={"to": "john@example.com", "subject": "Hello"},
                output="sent",
                status=CallStatus.SUCCESS,
                duration_ms=100,
            ),
        )

        redacted = redact_event(event, RedactionMode.MASK)

        assert redacted.privacy.pii_detected is True
        assert len(redacted.privacy.redacted_fields) > 0

    def test_redact_event_metadata(self) -> None:
        """Redact PII in event metadata."""
        event = ARLSEvent(
            agentlens_version="1.0",
            schema_type=SchemaType.TOOL_CALL,
            timestamp="2025-01-01T00:00:00Z",
            trace_id="trace_123",
            run_id="run_123",
            step_index=1,
            agent=AgentContext(name="TestAgent", phase=AgentPhase.PLAN),
            privacy=PrivacyData(pii_detected=False),
            metadata={
                "user_email": "alice@example.com",
                "user_name": "Alice",
            },
        )

        redacted = redact_event(event, RedactionMode.MASK)

        if redacted.metadata:
            assert "[REDACTED]" in redacted.metadata["user_email"]
            assert redacted.metadata["user_name"] == "Alice"

    def test_no_pii_in_event(self) -> None:
        """Event with no PII is unchanged."""
        event = ARLSEvent(
            agentlens_version="1.0",
            schema_type=SchemaType.TOOL_CALL,
            timestamp="2025-01-01T00:00:00Z",
            trace_id="trace_123",
            run_id="run_123",
            step_index=1,
            agent=AgentContext(name="TestAgent", phase=AgentPhase.PLAN),
            privacy=PrivacyData(pii_detected=False),
            tool=ToolCallData(
                name="add",
                input={"a": 1, "b": 2},
                output=3,
                status=CallStatus.SUCCESS,
                duration_ms=10,
            ),
        )

        redacted = redact_event(event, RedactionMode.MASK)

        assert redacted.privacy.pii_detected is False
        assert len(redacted.privacy.redacted_fields) == 0

    def test_redact_all_modes(self) -> None:
        """Test all redaction modes on same event."""
        event = ARLSEvent(
            agentlens_version="1.0",
            schema_type=SchemaType.TOOL_CALL,
            timestamp="2025-01-01T00:00:00Z",
            trace_id="trace_123",
            run_id="run_123",
            step_index=1,
            agent=AgentContext(name="TestAgent", phase=AgentPhase.PLAN),
            privacy=PrivacyData(pii_detected=False),
            metadata={"contact": "test@example.com"},
        )

        # MASK mode
        masked = redact_event(event, RedactionMode.MASK)
        if masked.metadata:
            assert "[REDACTED]" in masked.metadata["contact"]

        # HASH mode
        hashed = redact_event(event, RedactionMode.HASH)
        if hashed.metadata:
            assert "[sha256:" in hashed.metadata["contact"]

        # DROP mode
        dropped = redact_event(event, RedactionMode.DROP)
        if dropped.metadata:
            assert dropped.metadata["contact"] == ""

        # PLACEHOLDER mode
        placeholder = redact_event(event, RedactionMode.PLACEHOLDER)
        if placeholder.metadata:
            assert "[EMAIL]" in placeholder.metadata["contact"]


class TestRedactionResult:
    """Test RedactionResult dataclass."""

    def test_result_has_all_fields(self) -> None:
        """RedactionResult has all required fields."""
        result = redact_string("email@test.com", RedactionMode.MASK)

        assert hasattr(result, "original")
        assert hasattr(result, "redacted")
        assert hasattr(result, "detections")
        assert hasattr(result, "redaction_mode")

    def test_result_tracks_redaction_mode(self) -> None:
        """RedactionResult tracks which mode was used."""
        text = "email@test.com"

        result_mask = redact_string(text, RedactionMode.MASK)
        assert result_mask.redaction_mode == RedactionMode.MASK

        result_hash = redact_string(text, RedactionMode.HASH)
        assert result_hash.redaction_mode == RedactionMode.HASH
