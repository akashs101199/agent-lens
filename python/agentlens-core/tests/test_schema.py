"""Tests for ARLS schema types."""

import json
from datetime import datetime, timezone

import pytest

from agentlens_core.schema import (
    ARLS_VERSION,
    ARLSEvent,
    AgentContext,
    AgentPhase,
    CallStatus,
    ErrorData,
    LLMCallData,
    MemoryData,
    PrivacyData,
    RedactionMode,
    SchemaType,
    ToolCallData,
)


class TestSchemaVersion:
    """Test ARLS version constant."""

    def test_arls_version_is_correct(self) -> None:
        """ARLS_VERSION should be '1.0'."""
        assert ARLS_VERSION == "1.0"
        assert isinstance(ARLS_VERSION, str)


class TestEnums:
    """Test schema enum values."""

    def test_schema_type_values(self) -> None:
        """SchemaType enum has expected values."""
        assert SchemaType.AGENT_START.value == "AGENT_START"
        assert SchemaType.AGENT_END.value == "AGENT_END"
        assert SchemaType.LLM_CALL.value == "LLM_CALL"
        assert SchemaType.TOOL_CALL.value == "TOOL_CALL"

    def test_agent_phase_values(self) -> None:
        """AgentPhase enum has expected values."""
        assert AgentPhase.PLAN.value == "PLAN"
        assert AgentPhase.TOOL_CALL.value == "TOOL_CALL"
        assert AgentPhase.OBSERVE.value == "OBSERVE"
        assert AgentPhase.REFLECT.value == "REFLECT"
        assert AgentPhase.RESPOND.value == "RESPOND"
        assert AgentPhase.IDLE.value == "IDLE"

    def test_call_status_values(self) -> None:
        """CallStatus enum has expected values."""
        assert CallStatus.SUCCESS.value == "SUCCESS"
        assert CallStatus.FAILURE.value == "FAILURE"
        assert CallStatus.TIMEOUT.value == "TIMEOUT"
        assert CallStatus.CANCELLED.value == "CANCELLED"

    def test_redaction_mode_values(self) -> None:
        """RedactionMode enum has expected values."""
        assert RedactionMode.MASK.value == "MASK"
        assert RedactionMode.HASH.value == "HASH"
        assert RedactionMode.DROP.value == "DROP"
        assert RedactionMode.PLACEHOLDER.value == "PLACEHOLDER"


class TestARLSEvent:
    """Test ARLSEvent construction and validation."""

    def test_minimal_arls_event(self) -> None:
        """Can create minimal valid ARLSEvent."""
        event = ARLSEvent(
            agentlens_version=ARLS_VERSION,
            schema_type=SchemaType.AGENT_START,
            timestamp=datetime.now(timezone.utc).isoformat(),
            trace_id="trace_abc123",
            run_id="run_123_def",
            step_index=0,
            agent=AgentContext(name="TestAgent", phase=AgentPhase.PLAN),
            privacy=PrivacyData(pii_detected=False),
        )

        assert event.agentlens_version == "1.0"
        assert event.schema_type == SchemaType.AGENT_START
        assert event.agent.name == "TestAgent"

    def test_arls_event_with_llm_data(self) -> None:
        """Can create ARLSEvent with LLMCallData."""
        event = ARLSEvent(
            agentlens_version=ARLS_VERSION,
            schema_type=SchemaType.LLM_CALL,
            timestamp="2025-01-01T00:00:00.000Z",
            trace_id="trace_abc123",
            run_id="run_123_def",
            step_index=1,
            agent=AgentContext(name="TestAgent", phase=AgentPhase.PLAN),
            privacy=PrivacyData(pii_detected=False),
            llm=LLMCallData(
                model="claude-sonnet-4-20250514",
                provider="anthropic",
                prompt_tokens=100,
                completion_tokens=50,
                total_tokens=150,
                cost_usd=0.001,
                latency_ms=1000,
                finish_reason="end_turn",
            ),
        )

        assert event.schema_type == SchemaType.LLM_CALL
        assert event.llm is not None
        assert event.llm.model == "claude-sonnet-4-20250514"
        assert event.llm.total_tokens == 150

    def test_arls_event_with_tool_data(self) -> None:
        """Can create ARLSEvent with ToolCallData."""
        event = ARLSEvent(
            agentlens_version=ARLS_VERSION,
            schema_type=SchemaType.TOOL_CALL,
            timestamp="2025-01-01T00:00:00.000Z",
            trace_id="trace_abc123",
            run_id="run_123_def",
            step_index=2,
            agent=AgentContext(name="TestAgent", phase=AgentPhase.TOOL_CALL),
            privacy=PrivacyData(pii_detected=False),
            tool=ToolCallData(
                name="web_search",
                input={"query": "AI agents"},
                output=["result1", "result2"],
                status=CallStatus.SUCCESS,
                duration_ms=500,
            ),
        )

        assert event.schema_type == SchemaType.TOOL_CALL
        assert event.tool is not None
        assert event.tool.name == "web_search"
        assert event.tool.status == CallStatus.SUCCESS

    def test_arls_event_with_error_data(self) -> None:
        """Can create ARLSEvent with ErrorData."""
        event = ARLSEvent(
            agentlens_version=ARLS_VERSION,
            schema_type=SchemaType.ERROR,
            timestamp="2025-01-01T00:00:00.000Z",
            trace_id="trace_abc123",
            run_id="run_123_def",
            step_index=3,
            agent=AgentContext(name="TestAgent", phase=AgentPhase.IDLE),
            privacy=PrivacyData(pii_detected=False),
            error=ErrorData(
                code="TOOL_FAILURE",
                message="Tool returned an error",
                recoverable=True,
            ),
        )

        assert event.schema_type == SchemaType.ERROR
        assert event.error is not None
        assert event.error.code == "TOOL_FAILURE"

    def test_arls_event_version_validation(self) -> None:
        """ARLSEvent validates version on construction."""
        with pytest.raises(ValueError, match="Invalid ARLS version"):
            ARLSEvent(
                agentlens_version="2.0",  # Wrong version
                schema_type=SchemaType.AGENT_START,
                timestamp="2025-01-01T00:00:00.000Z",
                trace_id="trace_abc123",
                run_id="run_123_def",
                step_index=0,
                agent=AgentContext(name="TestAgent", phase=AgentPhase.PLAN),
                privacy=PrivacyData(pii_detected=False),
            )

    def test_arls_event_to_dict(self) -> None:
        """ARLSEvent.to_dict() produces valid dictionary."""
        event = ARLSEvent(
            agentlens_version=ARLS_VERSION,
            schema_type=SchemaType.LLM_CALL,
            timestamp="2025-01-01T00:00:00.000Z",
            trace_id="trace_abc123",
            run_id="run_123_def",
            step_index=1,
            agent=AgentContext(name="TestAgent", phase=AgentPhase.PLAN),
            privacy=PrivacyData(pii_detected=False),
            llm=LLMCallData(
                model="claude-sonnet-4-20250514",
                provider="anthropic",
                prompt_tokens=100,
                completion_tokens=50,
                total_tokens=150,
                cost_usd=0.001,
                latency_ms=1000,
                finish_reason="end_turn",
            ),
        )

        event_dict = event.to_dict()

        assert event_dict["agentlens_version"] == "1.0"
        assert event_dict["schema_type"] == "LLM_CALL"
        assert event_dict["agent"]["name"] == "TestAgent"
        assert event_dict["agent"]["phase"] == "PLAN"
        assert event_dict["llm"]["model"] == "claude-sonnet-4-20250514"

    def test_arls_event_to_dict_json_serializable(self) -> None:
        """ARLSEvent.to_dict() output is JSON serializable."""
        event = ARLSEvent(
            agentlens_version=ARLS_VERSION,
            schema_type=SchemaType.AGENT_START,
            timestamp="2025-01-01T00:00:00.000Z",
            trace_id="trace_abc123",
            run_id="run_123_def",
            step_index=0,
            agent=AgentContext(name="TestAgent", phase=AgentPhase.PLAN),
            privacy=PrivacyData(pii_detected=False),
        )

        event_dict = event.to_dict()
        json_str = json.dumps(event_dict)

        assert isinstance(json_str, str)
        assert "TestAgent" in json_str
        assert "AGENT_START" in json_str


class TestPrivacyData:
    """Test PrivacyData construction."""

    def test_privacy_data_minimal(self) -> None:
        """Can create minimal PrivacyData."""
        privacy = PrivacyData(pii_detected=False)
        assert privacy.pii_detected is False
        assert privacy.redacted_fields == []
        assert privacy.redaction_mode is None

    def test_privacy_data_with_redaction(self) -> None:
        """Can create PrivacyData with redaction mode."""
        privacy = PrivacyData(
            pii_detected=True,
            redacted_fields=["email", "api_key"],
            redaction_mode=RedactionMode.HASH,
        )
        assert privacy.pii_detected is True
        assert len(privacy.redacted_fields) == 2
        assert privacy.redaction_mode == RedactionMode.HASH
