"""Tests for human-readable renderer."""

import pytest

from agentlens_core import (
    ARLSEvent,
    SchemaType,
    AgentContext,
    AgentPhase,
    PrivacyData,
    LLMCallData,
    ToolCallData,
    CallStatus,
    ErrorData,
)
from agentlens_renderer import render_human, render_human_compact, Emoji


class TestRenderHumanLLMCall:
    """Test human rendering of LLM call events."""

    def test_render_llm_call(self) -> None:
        """Render LLM call event."""
        event = ARLSEvent(
            agentlens_version="1.0",
            schema_type=SchemaType.LLM_CALL,
            timestamp="2025-01-01T00:00:00Z",
            trace_id="trace_123",
            run_id="run_123",
            step_index=1,
            agent=AgentContext(name="TestAgent", phase=AgentPhase.PLAN),
            privacy=PrivacyData(pii_detected=False),
            llm=LLMCallData(
                model="claude-sonnet-4-20250514",
                provider="anthropic",
                prompt_tokens=1200,
                completion_tokens=340,
                total_tokens=1540,
                cost_usd=0.0087,
                latency_ms=1320,
                finish_reason="end_turn",
            ),
        )

        output = render_human(event)

        assert "🧠 LLM CALL" in output
        assert "claude-sonnet-4-20250514" in output
        assert "1540" in output or "1.5K" in output
        assert "end_turn" in output

    def test_llm_call_contains_cost(self) -> None:
        """LLM call rendering includes cost."""
        event = ARLSEvent(
            agentlens_version="1.0",
            schema_type=SchemaType.LLM_CALL,
            timestamp="2025-01-01T00:00:00Z",
            trace_id="trace_123",
            run_id="run_123",
            step_index=1,
            agent=AgentContext(name="TestAgent", phase=AgentPhase.PLAN),
            privacy=PrivacyData(pii_detected=False),
            llm=LLMCallData(
                model="gpt-4o",
                provider="openai",
                prompt_tokens=100,
                completion_tokens=50,
                total_tokens=150,
                cost_usd=0.0045,
                latency_ms=500,
                finish_reason="stop",
            ),
        )

        output = render_human(event)

        assert "$" in output  # Cost indicator
        assert "0.00" in output or "0.004" in output


class TestRenderHumanToolCall:
    """Test human rendering of tool call events."""

    def test_render_tool_call_success(self) -> None:
        """Render successful tool call."""
        event = ARLSEvent(
            agentlens_version="1.0",
            schema_type=SchemaType.TOOL_CALL,
            timestamp="2025-01-01T00:00:00Z",
            trace_id="trace_123",
            run_id="run_123",
            step_index=2,
            agent=AgentContext(name="TestAgent", phase=AgentPhase.TOOL_CALL),
            privacy=PrivacyData(pii_detected=False),
            tool=ToolCallData(
                name="web_search",
                input={"query": "AI agents"},
                output=["result1", "result2"],
                status=CallStatus.SUCCESS,
                duration_ms=842,
            ),
        )

        output = render_human(event)

        assert "🔧 TOOL CALL" in output
        assert "web_search" in output
        assert "✅" in output  # Success indicator
        assert "842ms" in output

    def test_render_tool_call_failure(self) -> None:
        """Render failed tool call."""
        event = ARLSEvent(
            agentlens_version="1.0",
            schema_type=SchemaType.TOOL_CALL,
            timestamp="2025-01-01T00:00:00Z",
            trace_id="trace_123",
            run_id="run_123",
            step_index=2,
            agent=AgentContext(name="TestAgent", phase=AgentPhase.TOOL_CALL),
            privacy=PrivacyData(pii_detected=False),
            tool=ToolCallData(
                name="database_query",
                input={"query": "SELECT..."},
                output=None,
                status=CallStatus.FAILURE,
                duration_ms=250,
                error_message="Connection timeout",
            ),
        )

        output = render_human(event)

        assert "🔧 TOOL CALL" in output
        assert "database_query" in output
        assert "❌" in output  # Failure indicator
        assert "Connection timeout" in output


class TestRenderHumanError:
    """Test human rendering of error events."""

    def test_render_error_event(self) -> None:
        """Render error event."""
        event = ARLSEvent(
            agentlens_version="1.0",
            schema_type=SchemaType.ERROR,
            timestamp="2025-01-01T00:00:00Z",
            trace_id="trace_123",
            run_id="run_123",
            step_index=3,
            agent=AgentContext(name="TestAgent", phase=AgentPhase.IDLE),
            privacy=PrivacyData(pii_detected=False),
            error=ErrorData(
                code="TOOL_FAILURE",
                message="Tool returned an error",
                recoverable=True,
            ),
        )

        output = render_human(event)

        assert "❌ ERROR" in output
        assert "TOOL_FAILURE" in output
        assert "Tool returned an error" in output


class TestRenderHumanAgentEvents:
    """Test human rendering of agent start/end events."""

    def test_render_agent_start(self) -> None:
        """Render agent start event."""
        event = ARLSEvent(
            agentlens_version="1.0",
            schema_type=SchemaType.AGENT_START,
            timestamp="2025-01-01T00:00:00Z",
            trace_id="trace_123",
            run_id="run_123",
            step_index=0,
            agent=AgentContext(name="ResearchAgent", phase=AgentPhase.PLAN),
            privacy=PrivacyData(pii_detected=False),
        )

        output = render_human(event)

        assert "🤖" in output
        assert "ResearchAgent" in output
        assert "run_123" in output
        assert "trace_123" in output

    def test_render_agent_end(self) -> None:
        """Render agent end event."""
        event = ARLSEvent(
            agentlens_version="1.0",
            schema_type=SchemaType.AGENT_END,
            timestamp="2025-01-01T00:00:00Z",
            trace_id="trace_123",
            run_id="run_123",
            step_index=3,
            agent=AgentContext(name="ResearchAgent", phase=AgentPhase.IDLE),
            privacy=PrivacyData(pii_detected=False),
        )

        output = render_human(event)

        # Agent end doesn't always show emoji in this simplified version
        assert "ResearchAgent" in output


class TestRenderHumanCompact:
    """Test compact human rendering."""

    def test_compact_llm_call(self) -> None:
        """Compact rendering of LLM call."""
        event = ARLSEvent(
            agentlens_version="1.0",
            schema_type=SchemaType.LLM_CALL,
            timestamp="2025-01-01T00:00:00Z",
            trace_id="trace_123",
            run_id="run_123",
            step_index=1,
            agent=AgentContext(name="TestAgent", phase=AgentPhase.PLAN),
            privacy=PrivacyData(pii_detected=False),
            llm=LLMCallData(
                model="claude-sonnet-4-20250514",
                provider="anthropic",
                prompt_tokens=1200,
                completion_tokens=340,
                total_tokens=1540,
                cost_usd=0.0087,
                latency_ms=1320,
                finish_reason="end_turn",
            ),
        )

        output = render_human_compact(event)

        assert isinstance(output, str)
        assert "🧠 LLM" in output
        assert "claude-sonnet-4-20250514" in output

    def test_compact_tool_call(self) -> None:
        """Compact rendering of tool call."""
        event = ARLSEvent(
            agentlens_version="1.0",
            schema_type=SchemaType.TOOL_CALL,
            timestamp="2025-01-01T00:00:00Z",
            trace_id="trace_123",
            run_id="run_123",
            step_index=2,
            agent=AgentContext(name="TestAgent", phase=AgentPhase.TOOL_CALL),
            privacy=PrivacyData(pii_detected=False),
            tool=ToolCallData(
                name="web_search",
                input={"query": "AI"},
                output=["result"],
                status=CallStatus.SUCCESS,
                duration_ms=842,
            ),
        )

        output = render_human_compact(event)

        assert "🔧" in output
        assert "web_search" in output
        assert "✅" in output


class TestRenderHumanPIIHandling:
    """Test PII handling in rendering."""

    def test_render_event_with_pii_detected(self) -> None:
        """Render event with PII detected."""
        event = ARLSEvent(
            agentlens_version="1.0",
            schema_type=SchemaType.TOOL_CALL,
            timestamp="2025-01-01T00:00:00Z",
            trace_id="trace_123",
            run_id="run_123",
            step_index=1,
            agent=AgentContext(name="TestAgent", phase=AgentPhase.PLAN),
            privacy=PrivacyData(
                pii_detected=True,
                redacted_fields=["tool.input.email", "tool.output.phone"],
            ),
            tool=ToolCallData(
                name="test",
                input={},
                output=None,
                status=CallStatus.SUCCESS,
                duration_ms=100,
            ),
        )

        output = render_human(event)

        # Should indicate PII was redacted
        assert "⚠️" in output or "PII" in output or "redacted" in output.lower()


class TestRenderHumanFormatting:
    """Test output formatting."""

    def test_output_is_string(self) -> None:
        """Render functions return strings."""
        event = ARLSEvent(
            agentlens_version="1.0",
            schema_type=SchemaType.AGENT_START,
            timestamp="2025-01-01T00:00:00Z",
            trace_id="trace_123",
            run_id="run_123",
            step_index=0,
            agent=AgentContext(name="TestAgent", phase=AgentPhase.PLAN),
            privacy=PrivacyData(pii_detected=False),
        )

        output = render_human(event)
        assert isinstance(output, str)
        assert len(output) > 0

    def test_compact_output_is_string(self) -> None:
        """Compact render functions return strings."""
        event = ARLSEvent(
            agentlens_version="1.0",
            schema_type=SchemaType.AGENT_START,
            timestamp="2025-01-01T00:00:00Z",
            trace_id="trace_123",
            run_id="run_123",
            step_index=0,
            agent=AgentContext(name="TestAgent", phase=AgentPhase.PLAN),
            privacy=PrivacyData(pii_detected=False),
        )

        output = render_human_compact(event)
        assert isinstance(output, str)
        assert len(output) > 0
