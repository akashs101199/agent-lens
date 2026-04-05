"""Tests for event builders."""

import pytest

from agentlens_core.context import create_run_context, run_in_context
from agentlens_core.event_builder import (
    build_agent_end_event,
    build_agent_start_event,
    build_error_event,
    build_llm_event,
    build_tool_event,
)
from agentlens_core.schema import (
    ARLS_VERSION,
    CallStatus,
    SchemaType,
)


class TestBuildLLMEvent:
    """Test LLM event builder."""

    @pytest.mark.asyncio
    async def test_build_llm_event(self) -> None:
        """Build a complete LLM_CALL event."""
        ctx = create_run_context("TestAgent")

        async def inner() -> None:
            event = build_llm_event(
                model="claude-sonnet-4-20250514",
                provider="anthropic",
                prompt_tokens=1200,
                completion_tokens=340,
                cost_usd=0.0087,
                latency_ms=1320,
                finish_reason="end_turn",
            )

            assert event.agentlens_version == ARLS_VERSION
            assert event.schema_type == SchemaType.LLM_CALL
            assert event.run_id == ctx.run_id
            assert event.trace_id == ctx.trace_id
            assert event.llm is not None
            assert event.llm.model == "claude-sonnet-4-20250514"
            assert event.llm.total_tokens == 1540

        await run_in_context(ctx, inner)

    @pytest.mark.asyncio
    async def test_llm_event_includes_ttft(self) -> None:
        """LLM event can include time_to_first_token."""
        ctx = create_run_context("TestAgent")

        async def inner() -> None:
            event = build_llm_event(
                model="gpt-4o",
                provider="openai",
                prompt_tokens=100,
                completion_tokens=50,
                cost_usd=0.001,
                latency_ms=500,
                finish_reason="stop",
                time_to_first_token_ms=120,
            )

            assert event.llm is not None
            assert event.llm.time_to_first_token_ms == 120

        await run_in_context(ctx, inner)


class TestBuildToolEvent:
    """Test tool event builder."""

    @pytest.mark.asyncio
    async def test_build_tool_event_success(self) -> None:
        """Build a successful TOOL_CALL event."""
        ctx = create_run_context("TestAgent")

        async def inner() -> None:
            event = build_tool_event(
                name="web_search",
                input_data={"query": "AI agents"},
                output_data=[{"title": "Result 1"}, {"title": "Result 2"}],
                status=CallStatus.SUCCESS,
                duration_ms=842,
            )

            assert event.schema_type == SchemaType.TOOL_CALL
            assert event.tool is not None
            assert event.tool.name == "web_search"
            assert event.tool.status == CallStatus.SUCCESS
            assert event.tool.duration_ms == 842

        await run_in_context(ctx, inner)

    @pytest.mark.asyncio
    async def test_build_tool_event_failure(self) -> None:
        """Build a failed TOOL_CALL event with error message."""
        ctx = create_run_context("TestAgent")

        async def inner() -> None:
            event = build_tool_event(
                name="database_query",
                input_data={"query": "SELECT * FROM users"},
                output_data=None,
                status=CallStatus.FAILURE,
                duration_ms=250,
                error_message="Connection timeout",
            )

            assert event.tool is not None
            assert event.tool.status == CallStatus.FAILURE
            assert event.tool.error_message == "Connection timeout"

        await run_in_context(ctx, inner)


class TestBuildAgentEvents:
    """Test agent start/end event builders."""

    @pytest.mark.asyncio
    async def test_build_agent_start_event(self) -> None:
        """Build an AGENT_START event."""
        ctx = create_run_context("ResearchAgent")

        async def inner() -> None:
            event = build_agent_start_event("ResearchAgent")

            assert event.schema_type == SchemaType.AGENT_START
            assert event.step_index == 0
            assert event.agent.name == "ResearchAgent"

        await run_in_context(ctx, inner)

    @pytest.mark.asyncio
    async def test_build_agent_end_event(self) -> None:
        """Build an AGENT_END event."""
        ctx = create_run_context("ResearchAgent")

        async def inner() -> None:
            event = build_agent_end_event(
                name="ResearchAgent",
                step_count=3,
                total_cost_usd=0.0048,
                total_tokens=1540,
                duration_ms=2160,
            )

            assert event.schema_type == SchemaType.AGENT_END
            assert event.metadata is not None
            assert event.metadata["step_count"] == 3
            assert event.metadata["total_cost_usd"] == 0.0048
            assert event.metadata["total_tokens"] == 1540

        await run_in_context(ctx, inner)


class TestBuildErrorEvent:
    """Test error event builder."""

    @pytest.mark.asyncio
    async def test_build_error_event(self) -> None:
        """Build an ERROR event from exception."""
        ctx = create_run_context("TestAgent")

        async def inner() -> None:
            error = ValueError("Invalid input")
            event = build_error_event(error)

            assert event.schema_type == SchemaType.ERROR
            assert event.error is not None
            assert event.error.code == "ValueError"
            assert event.error.message == "Invalid input"
            assert event.error.recoverable is True

        await run_in_context(ctx, inner)

    @pytest.mark.asyncio
    async def test_build_error_event_with_context(self) -> None:
        """Build ERROR event with context string."""
        ctx = create_run_context("TestAgent")

        async def inner() -> None:
            error = RuntimeError("Tool failed")
            event = build_error_event(
                error,
                schema_type=SchemaType.TOOL_CALL,
                context_str="web_search tool execution",
            )

            assert event.error is not None
            assert event.metadata is not None
            assert event.metadata["context"] == "web_search tool execution"

        await run_in_context(ctx, inner)


class TestEventTimestamps:
    """Test that events have valid timestamps."""

    @pytest.mark.asyncio
    async def test_event_timestamp_is_iso8601(self) -> None:
        """Event timestamp is ISO 8601 format."""
        ctx = create_run_context("TestAgent")

        async def inner() -> None:
            event = build_agent_start_event("TestAgent")

            # Timestamp should match ISO 8601 with Z suffix
            assert event.timestamp.endswith("Z")
            assert "T" in event.timestamp
            assert len(event.timestamp) == 24  # 2025-01-01T00:00:00.000Z

        await run_in_context(ctx, inner)


class TestEventMetadata:
    """Test event metadata handling."""

    @pytest.mark.asyncio
    async def test_llm_event_with_metadata(self) -> None:
        """LLM event can include custom metadata."""
        ctx = create_run_context("TestAgent")

        async def inner() -> None:
            event = build_llm_event(
                model="gpt-4o",
                provider="openai",
                prompt_tokens=100,
                completion_tokens=50,
                cost_usd=0.001,
                latency_ms=500,
                finish_reason="stop",
                metadata={"user_id": "12345", "session": "abc"},
            )

            assert event.metadata is not None
            assert event.metadata["user_id"] == "12345"
            assert event.metadata["session"] == "abc"

        await run_in_context(ctx, inner)
