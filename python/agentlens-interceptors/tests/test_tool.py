"""Tests for tool wrapper."""

import asyncio

import pytest

from agentlens_core import create_run_context, run_in_context
from agentlens_interceptors.tool import wrap_tool, ToolWrapper


class TestWrapTool:
    """Test wrap_tool function."""

    @pytest.mark.asyncio
    async def test_wrap_tool_success(self) -> None:
        """wrap_tool executes function and returns result."""
        async def dummy_tool(query: str) -> list[str]:
            return ["result1", "result2"]

        ctx = create_run_context("TestAgent")

        async def inner() -> list[str]:
            result = await wrap_tool("search", dummy_tool, query="test")
            return result

        result = await run_in_context(ctx, inner)
        assert result == ["result1", "result2"]

    @pytest.mark.asyncio
    async def test_wrap_tool_preserves_return_value(self) -> None:
        """wrap_tool preserves exact return value."""
        async def return_dict() -> dict[str, int]:
            return {"a": 1, "b": 2}

        ctx = create_run_context("TestAgent")

        async def inner() -> dict[str, int]:
            result = await wrap_tool("dict_tool", return_dict)
            return result

        result = await run_in_context(ctx, inner)
        assert result == {"a": 1, "b": 2}

    @pytest.mark.asyncio
    async def test_wrap_tool_with_args(self) -> None:
        """wrap_tool passes arguments correctly."""
        async def add(a: int, b: int) -> int:
            return a + b

        ctx = create_run_context("TestAgent")

        async def inner() -> int:
            result = await wrap_tool("add", add, 3, 4)
            return result

        result = await run_in_context(ctx, inner)
        assert result == 7

    @pytest.mark.asyncio
    async def test_wrap_tool_with_kwargs(self) -> None:
        """wrap_tool passes keyword arguments correctly."""
        async def greet(person: str, greeting: str = "Hello") -> str:
            return f"{greeting}, {person}"

        ctx = create_run_context("TestAgent")

        async def inner() -> str:
            result = await wrap_tool("greet", greet, person="Alice", greeting="Hi")
            return result

        result = await run_in_context(ctx, inner)
        assert result == "Hi, Alice"

    @pytest.mark.asyncio
    async def test_wrap_tool_reraises_exception(self) -> None:
        """wrap_tool re-raises exceptions without swallowing."""
        async def failing_tool() -> None:
            raise ValueError("Tool error")

        ctx = create_run_context("TestAgent")

        async def inner() -> None:
            with pytest.raises(ValueError, match="Tool error"):
                await wrap_tool("failing", failing_tool)

        await run_in_context(ctx, inner)

    @pytest.mark.asyncio
    async def test_wrap_tool_timeout_handling(self) -> None:
        """wrap_tool handles timeouts."""
        async def slow_tool() -> None:
            await asyncio.sleep(10)

        ctx = create_run_context("TestAgent")

        async def inner() -> None:
            with pytest.raises(asyncio.TimeoutError):
                # Wrap in a timeout
                await asyncio.wait_for(
                    wrap_tool("slow", slow_tool),
                    timeout=0.1
                )

        await run_in_context(ctx, inner)


class TestToolWrapper:
    """Test ToolWrapper decorator."""

    @pytest.mark.asyncio
    async def test_tool_wrapper_as_decorator(self) -> None:
        """ToolWrapper works as a decorator."""
        @ToolWrapper("decorated_tool")
        async def my_tool(x: int) -> int:
            return x * 2

        ctx = create_run_context("TestAgent")

        async def inner() -> int:
            result = await my_tool(5)
            return result

        result = await run_in_context(ctx, inner)
        assert result == 10

    @pytest.mark.asyncio
    async def test_tool_wrapper_preserves_exceptions(self) -> None:
        """ToolWrapper decorator preserves exceptions."""
        @ToolWrapper("bad_tool")
        async def bad_tool() -> None:
            raise RuntimeError("Bad thing happened")

        ctx = create_run_context("TestAgent")

        async def inner() -> None:
            with pytest.raises(RuntimeError, match="Bad thing happened"):
                await bad_tool()

        await run_in_context(ctx, inner)

    @pytest.mark.asyncio
    async def test_tool_wrapper_with_multiple_args(self) -> None:
        """ToolWrapper handles multiple arguments."""
        @ToolWrapper("multi_arg")
        async def multi_arg(a: int, b: int, c: int) -> int:
            return a + b + c

        ctx = create_run_context("TestAgent")

        async def inner() -> int:
            result = await multi_arg(1, 2, 3)
            return result

        result = await run_in_context(ctx, inner)
        assert result == 6

    @pytest.mark.asyncio
    async def test_tool_wrapper_with_kwargs(self) -> None:
        """ToolWrapper handles keyword arguments."""
        @ToolWrapper("kwargs_tool")
        async def kwargs_tool(name: str, age: int = 30) -> str:
            return f"{name} is {age}"

        ctx = create_run_context("TestAgent")

        async def inner() -> str:
            result = await kwargs_tool("Alice", age=25)
            return result

        result = await run_in_context(ctx, inner)
        assert result == "Alice is 25"
