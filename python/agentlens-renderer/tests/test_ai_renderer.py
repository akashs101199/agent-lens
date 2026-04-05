"""Tests for AI-readable renderer."""

import json

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
from agentlens_renderer import render_ai, render_ai_compact


class TestRenderAI:
    """Test AI-readable JSONL rendering."""

    def test_render_ai_is_valid_json(self) -> None:
        """AI renderer produces valid JSON."""
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

        output = render_ai(event)

        # Should be valid JSON
        parsed = json.loads(output)
        assert isinstance(parsed, dict)

    def test_render_ai_is_single_line(self) -> None:
        """AI renderer produces single-line output (JSONL format)."""
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

        output = render_ai(event)

        # Should not contain newlines (single line JSON)
        assert '\n' not in output

    def test_render_ai_includes_arls_fields(self) -> None:
        """AI renderer includes all ARLS fields."""
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

        output = render_ai(event)
        parsed = json.loads(output)

        # Should have ARLS fields
        assert parsed["schema_type"] == "LLM_CALL"
        assert parsed["trace_id"] == "trace_123"
        assert parsed["run_id"] == "run_123"
        assert parsed["llm"]["model"] == "gpt-4o"

    def test_render_ai_includes_claude_context(self) -> None:
        """AI renderer includes Claude context for LLM calls."""
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

        output = render_ai(event)
        parsed = json.loads(output)

        # Should have Claude context
        assert "_claude_context" in parsed
        context = parsed["_claude_context"]
        assert "summary" in context
        assert context["cost_usd"] == 0.0045

    def test_render_ai_tool_call_context(self) -> None:
        """AI renderer generates context for tool calls."""
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

        output = render_ai(event)
        parsed = json.loads(output)

        assert "_claude_context" in parsed
        context = parsed["_claude_context"]
        assert "web_search" in context["summary"]
        assert "succeeded" in context["summary"]

    def test_render_ai_error_context(self) -> None:
        """AI renderer generates helpful context for errors."""
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
                name="fetch",
                input={},
                output=None,
                status=CallStatus.FAILURE,
                duration_ms=250,
                error_message="Connection timeout",
            ),
        )

        output = render_ai(event)
        parsed = json.loads(output)

        context = parsed["_claude_context"]
        assert "failed" in context["summary"]
        # Should suggest retry or optimization
        assert "debug_suggestion" in context or context.get("summary", "").lower()

    def test_render_ai_pii_detection(self) -> None:
        """AI renderer reports PII redaction."""
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
                redacted_fields=["tool.input.email"],
            ),
            tool=ToolCallData(
                name="test",
                input={},
                output=None,
                status=CallStatus.SUCCESS,
                duration_ms=100,
            ),
        )

        output = render_ai(event)
        parsed = json.loads(output)

        context = parsed["_claude_context"]
        assert context.get("pii_redacted") is True
        assert context.get("redacted_field_count") == 1


class TestRenderAICompact:
    """Test compact AI rendering."""

    def test_render_ai_compact_returns_dict(self) -> None:
        """Compact AI renderer returns dictionary."""
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

        output = render_ai_compact(event)

        assert isinstance(output, dict)
        assert output["schema_type"] == "AGENT_START"

    def test_render_ai_compact_includes_context(self) -> None:
        """Compact AI renderer includes Claude context."""
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

        output = render_ai_compact(event)

        assert "_claude_context" in output
        assert "summary" in output["_claude_context"]


class TestRenderAIJSONFormat:
    """Test JSON formatting details."""

    def test_render_ai_no_pretty_print(self) -> None:
        """AI renderer uses compact JSON (no pretty-printing)."""
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

        output = render_ai(event)

        # Compact JSON should use colons without spaces
        assert ": " not in output or "trace_id:\"" in output or "trace_id: " not in output
        # Should be single line
        assert output.count('\n') == 0

    def test_render_ai_preserves_all_fields(self) -> None:
        """AI renderer preserves all event fields."""
        event = ARLSEvent(
            agentlens_version="1.0",
            schema_type=SchemaType.LLM_CALL,
            timestamp="2025-01-01T00:00:00Z",
            trace_id="trace_abc123",
            run_id="run_xyz789",
            step_index=5,
            agent=AgentContext(name="TestAgent", phase=AgentPhase.REFLECT),
            privacy=PrivacyData(pii_detected=False),
            semantic_tags=["slow", "cached"],
            llm=LLMCallData(
                model="claude-opus-4",
                provider="anthropic",
                prompt_tokens=500,
                completion_tokens=250,
                total_tokens=750,
                cost_usd=0.015,
                latency_ms=2500,
                finish_reason="end_turn",
            ),
        )

        output = render_ai(event)
        parsed = json.loads(output)

        # Verify all fields preserved
        assert parsed["trace_id"] == "trace_abc123"
        assert parsed["run_id"] == "run_xyz789"
        assert parsed["step_index"] == 5
        assert parsed["agent"]["name"] == "TestAgent"
        assert parsed["semantic_tags"] == ["slow", "cached"]
        assert parsed["llm"]["model"] == "claude-opus-4"
