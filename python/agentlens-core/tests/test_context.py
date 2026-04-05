"""Tests for run context propagation."""

import asyncio

import pytest

from agentlens_core.context import (
    RunContext,
    create_run_context,
    get_run_context,
    increment_step,
    run_in_context,
)
from agentlens_core.errors import ContextError


class TestRunContext:
    """Test RunContext dataclass."""

    def test_create_run_context(self) -> None:
        """create_run_context generates valid IDs."""
        ctx = create_run_context("MyAgent")

        assert ctx.agent_name == "MyAgent"
        assert ctx.run_id.startswith("run_")
        assert ctx.trace_id.startswith("trace_")
        assert ctx.step_index == 0

    def test_run_context_ids_are_unique(self) -> None:
        """Multiple run contexts have different IDs."""
        ctx1 = create_run_context("Agent1")
        ctx2 = create_run_context("Agent2")

        assert ctx1.run_id != ctx2.run_id
        assert ctx1.trace_id != ctx2.trace_id


class TestContextPropagation:
    """Test contextvars-based context propagation."""

    @pytest.mark.asyncio
    async def test_get_run_context_outside_scope(self) -> None:
        """get_run_context returns None outside run_in_context."""
        ctx = get_run_context()
        assert ctx is None

    @pytest.mark.asyncio
    async def test_get_run_context_inside_scope(self) -> None:
        """get_run_context returns context inside run_in_context."""
        run_ctx = create_run_context("TestAgent")

        async def inner() -> RunContext | None:
            return get_run_context()

        result = await run_in_context(run_ctx, inner)
        assert result is not None
        assert result.agent_name == "TestAgent"

    @pytest.mark.asyncio
    async def test_increment_step_inside_scope(self) -> None:
        """increment_step increments step_index inside run_in_context."""
        run_ctx = create_run_context("TestAgent")

        async def inner() -> int:
            increment_step()
            ctx = get_run_context()
            assert ctx is not None
            return ctx.step_index

        result = await run_in_context(run_ctx, inner)
        assert result == 1

    @pytest.mark.asyncio
    async def test_increment_step_outside_scope(self) -> None:
        """increment_step raises ContextError outside run_in_context."""
        with pytest.raises(ContextError):
            increment_step()

    @pytest.mark.asyncio
    async def test_context_isolation_across_runs(self) -> None:
        """Concurrent runs have independent contexts."""
        ctx1 = create_run_context("Agent1")
        ctx2 = create_run_context("Agent2")

        async def task1() -> tuple[str, int]:
            increment_step()
            ctx = get_run_context()
            assert ctx is not None
            increment_step()
            ctx = get_run_context()
            assert ctx is not None
            return (ctx.run_id, ctx.step_index)

        async def task2() -> tuple[str, int]:
            increment_step()
            ctx = get_run_context()
            assert ctx is not None
            return (ctx.run_id, ctx.step_index)

        result1 = await run_in_context(ctx1, task1)
        result2 = await run_in_context(ctx2, task2)

        assert result1[0] == ctx1.run_id
        assert result1[1] == 2
        assert result2[0] == ctx2.run_id
        assert result2[1] == 1

    @pytest.mark.asyncio
    async def test_nested_async_calls_share_context(self) -> None:
        """Nested async calls share the same context."""
        ctx = create_run_context("TestAgent")

        async def nested() -> int:
            increment_step()
            nested_ctx = get_run_context()
            assert nested_ctx is not None
            return nested_ctx.step_index

        async def outer() -> int:
            increment_step()
            step1 = await nested()
            return step1

        result = await run_in_context(ctx, outer)
        assert result == 2

    @pytest.mark.asyncio
    async def test_concurrent_tasks_isolation(self) -> None:
        """Concurrent tasks with different contexts don't interfere."""
        ctx1 = create_run_context("Agent1")
        ctx2 = create_run_context("Agent2")

        async def task(expected_agent: str) -> int:
            increment_step()
            increment_step()
            ctx = get_run_context()
            assert ctx is not None
            assert ctx.agent_name == expected_agent
            return ctx.step_index

        async def run_both() -> tuple[int, int]:
            result1 = await asyncio.create_task(run_in_context(ctx1, lambda: task("Agent1")))
            result2 = await asyncio.create_task(run_in_context(ctx2, lambda: task("Agent2")))
            return (result1, result2)

        r1, r2 = await run_both()
        assert r1 == 2
        assert r2 == 2
