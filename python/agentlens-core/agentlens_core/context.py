"""
Run context propagation using contextvars.

Manages run_id, trace_id, and step_index across async call chains without
passing them as arguments. Uses Python's contextvars for async-safe storage.
"""

import secrets
import uuid
from contextvars import ContextVar
from dataclasses import dataclass, field
from typing import Any, Awaitable, Callable, Optional, TypeVar

T = TypeVar('T')


@dataclass
class RunContext:
    """
    Holds the current run's context information.

    Attributes:
        agent_name: Name of the agent running this trace
        run_id: Unique identifier for this run (format: run_TIMESTAMP_HEX)
        trace_id: Unique identifier for this trace (format: trace_HEX)
        step_index: Current step number in the trace
    """

    agent_name: str
    run_id: str
    trace_id: str
    step_index: int = 0


# Context variable for storing the current run context
_run_context_var: ContextVar[Optional[RunContext]] = ContextVar(
    "agentlens_run_context", default=None
)


def create_run_context(agent_name: str) -> RunContext:
    """
    Create a new RunContext with generated IDs.

    Args:
        agent_name: Name of the agent for this run

    Returns:
        A new RunContext with generated run_id and trace_id
    """
    timestamp = int(__import__('time').time() * 1000)  # milliseconds
    hex_suffix = secrets.token_hex(6)
    run_id = f"run_{timestamp}_{hex_suffix}"

    trace_id = f"trace_{uuid.uuid4().hex[:12]}"

    return RunContext(
        agent_name=agent_name,
        run_id=run_id,
        trace_id=trace_id,
        step_index=0,
    )


def get_run_context() -> Optional[RunContext]:
    """
    Get the current run context.

    Returns:
        The current RunContext if inside run_in_context(), None otherwise
    """
    return _run_context_var.get()


async def run_in_context(
    ctx: RunContext,
    fn: Callable[[], Awaitable[T]],
) -> T:
    """
    Execute a function with the given context active.

    The context is available to all nested async calls via get_run_context().

    Args:
        ctx: The RunContext to activate
        fn: Async function to execute

    Returns:
        The result of fn()

    Example:
        >>> ctx = create_run_context("MyAgent")
        >>> result = await run_in_context(ctx, my_async_function)
    """
    token = _run_context_var.set(ctx)
    try:
        return await fn()
    finally:
        _run_context_var.reset(token)


def increment_step() -> None:
    """
    Increment the step_index in the current context.

    Raises:
        ContextError: If called outside a run_in_context() scope

    Example:
        >>> ctx = create_run_context("MyAgent")
        >>> async def my_fn():
        ...     increment_step()  # step_index becomes 1
        >>> await run_in_context(ctx, my_fn)
    """
    from agentlens_core.errors import ContextError

    ctx = get_run_context()
    if ctx is None:
        raise ContextError(
            "Cannot increment step: no active RunContext. "
            "Call get_run_context() to check if you're inside run_in_context()."
        )
    ctx.step_index += 1
