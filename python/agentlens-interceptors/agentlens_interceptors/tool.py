"""
Generic async function wrapper for tool call logging.

Wraps any async function as an AgentLens-traced tool, automatically logging
input, output, duration, and status.
"""

import asyncio
import time
from typing import Any, Callable, Coroutine, Optional, TypeVar

from agentlens_core import build_tool_event, CallStatus, get_run_context

T = TypeVar('T')


async def wrap_tool(
    name: str,
    fn: Callable[..., Coroutine[Any, Any, T]],
    *args: Any,
    **kwargs: Any,
) -> T:
    """
    Execute an async function as a traced tool call.

    Logs the tool call with input, output, duration, and status to AgentLens.
    If the function raises an exception, it is re-raised after logging.

    Args:
        name: Name of the tool (for logging)
        fn: Async function to wrap
        *args: Positional arguments to pass to fn
        **kwargs: Keyword arguments to pass to fn

    Returns:
        The return value of fn

    Raises:
        Any exception raised by fn (not swallowed)

    Example:
        >>> async def my_tool(query: str) -> list[str]:
        ...     return ["result1", "result2"]
        >>> result = await wrap_tool("search", my_tool, query="test")
    """
    start_time = time.time()
    start_ms = int(start_time * 1000)

    # Prepare input data
    input_data: dict[str, Any] = {}
    for i, arg in enumerate(args):
        input_data[f"arg_{i}"] = arg
    input_data.update(kwargs)

    try:
        # Call the function
        result = await fn(*args, **kwargs)

        # Calculate duration
        end_time = time.time()
        duration_ms = (end_time - start_time) * 1000

        # Build event
        ctx = get_run_context()
        if ctx is not None:
            event = build_tool_event(
                name=name,
                input_data=input_data,
                output_data=result,
                status=CallStatus.SUCCESS,
                duration_ms=duration_ms,
            )
            # Note: We don't have transport yet, so event is just created
            # In the full implementation, this would be sent to transports

        return result

    except asyncio.TimeoutError as e:
        # Handle timeout specifically
        end_time = time.time()
        duration_ms = (end_time - start_time) * 1000

        ctx = get_run_context()
        if ctx is not None:
            event = build_tool_event(
                name=name,
                input_data=input_data,
                output_data=None,
                status=CallStatus.TIMEOUT,
                duration_ms=duration_ms,
                error_message=str(e),
            )

        raise

    except Exception as e:
        # Log failure and re-raise
        end_time = time.time()
        duration_ms = (end_time - start_time) * 1000

        ctx = get_run_context()
        if ctx is not None:
            event = build_tool_event(
                name=name,
                input_data=input_data,
                output_data=None,
                status=CallStatus.FAILURE,
                duration_ms=duration_ms,
                error_message=str(e),
            )

        raise


class ToolWrapper:
    """
    Decorator for wrapping async functions as traced tools.

    Usage:
        @ToolWrapper("my_tool")
        async def my_tool(query: str) -> str:
            return "result"

        result = await my_tool("test")
    """

    def __init__(self, name: str) -> None:
        """
        Initialize the tool wrapper.

        Args:
            name: Name of the tool for logging
        """
        self.name = name

    def __call__(
        self,
        fn: Callable[..., Coroutine[Any, Any, T]],
    ) -> Callable[..., Coroutine[Any, Any, T]]:
        """
        Decorate an async function.

        Args:
            fn: The async function to wrap

        Returns:
            A wrapped version that logs to AgentLens
        """
        async def wrapped(*args: Any, **kwargs: Any) -> T:
            return await wrap_tool(self.name, fn, *args, **kwargs)

        return wrapped
