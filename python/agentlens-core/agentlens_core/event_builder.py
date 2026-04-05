"""
Event builders for constructing ARLS-compliant log events.

These factory functions create valid ARLSEvent objects from raw data,
handling defaults, validation, and context propagation automatically.
"""

from datetime import datetime, timezone
from typing import Any, Optional

from agentlens_core.context import get_run_context, create_run_context, increment_step
from agentlens_core.schema import (
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
    ARLS_VERSION,
)


def _get_or_create_context() -> Any:
    """
    Get the current context or create a temporary one.

    Returns a RunContext, creating a new one if none is active.
    This allows logging outside of explicit run_in_context() scopes.
    """
    ctx = get_run_context()
    if ctx is None:
        return create_run_context("UnnamedAgent")
    return ctx


def _now_iso8601() -> str:
    """Return current time as ISO 8601 string (UTC)."""
    return datetime.now(timezone.utc).isoformat(timespec='milliseconds').replace('+00:00', 'Z')


def _generate_debug_hint(
    schema_type: SchemaType,
    error: Optional[Exception] = None,
    context: Optional[str] = None,
) -> Optional[str]:
    """
    Generate ai_debug_hint for common error patterns.

    Args:
        schema_type: The event type
        error: Optional exception for ERROR schema_type
        context: Optional context string

    Returns:
        A string hint for Claude Code, or None if no hint applies
    """
    if schema_type == SchemaType.ERROR and error:
        error_str = str(error)
        if "context" in error_str.lower() or "overflow" in error_str.lower():
            return "CONTEXT_OVERFLOW: The agent exceeded token limits"
        if "tool" in error_str.lower() or "call" in error_str.lower():
            return "TOOL_FAILURE: The tool call returned an error"
        if "loop" in error_str.lower():
            return "LOOP_DETECTED: The agent may be in a decision loop"

    return None


def build_llm_event(
    model: str,
    provider: str,
    prompt_tokens: int,
    completion_tokens: int,
    cost_usd: float,
    latency_ms: float,
    finish_reason: str,
    time_to_first_token_ms: Optional[float] = None,
    metadata: Optional[dict[str, Any]] = None,
) -> ARLSEvent:
    """
    Build an LLM_CALL event.

    Args:
        model: Model identifier (e.g., 'claude-sonnet-4-20250514')
        provider: Provider name (e.g., 'anthropic', 'openai')
        prompt_tokens: Number of input tokens
        completion_tokens: Number of output tokens
        cost_usd: Estimated cost in USD
        latency_ms: Total time in milliseconds
        finish_reason: Completion reason (e.g., 'end_turn', 'max_tokens')
        time_to_first_token_ms: Optional time to first token
        metadata: Optional additional metadata

    Returns:
        A complete ARLSEvent of type LLM_CALL
    """
    ctx = _get_or_create_context()
    increment_step()

    return ARLSEvent(
        agentlens_version=ARLS_VERSION,
        schema_type=SchemaType.LLM_CALL,
        timestamp=_now_iso8601(),
        trace_id=ctx.trace_id,
        run_id=ctx.run_id,
        step_index=ctx.step_index,
        agent=AgentContext(
            name=ctx.agent_name,
            phase=AgentPhase.PLAN,  # Could be set based on context
        ),
        privacy=PrivacyData(pii_detected=False),
        semantic_tags=[],
        llm=LLMCallData(
            model=model,
            provider=provider,
            prompt_tokens=prompt_tokens,
            completion_tokens=completion_tokens,
            total_tokens=prompt_tokens + completion_tokens,
            cost_usd=cost_usd,
            latency_ms=latency_ms,
            finish_reason=finish_reason,
            time_to_first_token_ms=time_to_first_token_ms,
        ),
        metadata=metadata,
    )


def build_tool_event(
    name: str,
    input_data: dict[str, Any],
    output_data: Any,
    status: CallStatus,
    duration_ms: float,
    error_message: Optional[str] = None,
    metadata: Optional[dict[str, Any]] = None,
) -> ARLSEvent:
    """
    Build a TOOL_CALL event.

    Args:
        name: Tool name
        input_data: Tool input arguments
        output_data: Tool output result
        status: Completion status (SUCCESS, FAILURE, TIMEOUT, CANCELLED)
        duration_ms: Execution time in milliseconds
        error_message: Optional error message if status is FAILURE
        metadata: Optional additional metadata

    Returns:
        A complete ARLSEvent of type TOOL_CALL
    """
    ctx = _get_or_create_context()
    increment_step()

    return ARLSEvent(
        agentlens_version=ARLS_VERSION,
        schema_type=SchemaType.TOOL_CALL,
        timestamp=_now_iso8601(),
        trace_id=ctx.trace_id,
        run_id=ctx.run_id,
        step_index=ctx.step_index,
        agent=AgentContext(
            name=ctx.agent_name,
            phase=AgentPhase.PLAN,
        ),
        privacy=PrivacyData(pii_detected=False),
        semantic_tags=[],
        tool=ToolCallData(
            name=name,
            input=input_data,
            output=output_data,
            status=status,
            duration_ms=duration_ms,
            error_message=error_message,
        ),
        metadata=metadata,
    )


def build_agent_start_event(
    name: str,
    metadata: Optional[dict[str, Any]] = None,
) -> ARLSEvent:
    """
    Build an AGENT_START event.

    Args:
        name: Agent name
        metadata: Optional additional metadata

    Returns:
        A complete ARLSEvent of type AGENT_START
    """
    ctx = _get_or_create_context()

    return ARLSEvent(
        agentlens_version=ARLS_VERSION,
        schema_type=SchemaType.AGENT_START,
        timestamp=_now_iso8601(),
        trace_id=ctx.trace_id,
        run_id=ctx.run_id,
        step_index=0,
        agent=AgentContext(name=name, phase=AgentPhase.PLAN),
        privacy=PrivacyData(pii_detected=False),
        semantic_tags=[],
        metadata=metadata,
    )


def build_agent_end_event(
    name: str,
    step_count: int,
    total_cost_usd: float,
    total_tokens: int,
    duration_ms: float,
    metadata: Optional[dict[str, Any]] = None,
) -> ARLSEvent:
    """
    Build an AGENT_END event.

    Args:
        name: Agent name
        step_count: Total number of steps executed
        total_cost_usd: Total cost of all LLM calls
        total_tokens: Total tokens used
        duration_ms: Total execution time in milliseconds
        metadata: Optional additional metadata

    Returns:
        A complete ARLSEvent of type AGENT_END
    """
    ctx = _get_or_create_context()

    return ARLSEvent(
        agentlens_version=ARLS_VERSION,
        schema_type=SchemaType.AGENT_END,
        timestamp=_now_iso8601(),
        trace_id=ctx.trace_id,
        run_id=ctx.run_id,
        step_index=step_count,
        agent=AgentContext(name=name, phase=AgentPhase.IDLE),
        privacy=PrivacyData(pii_detected=False),
        semantic_tags=[],
        metadata={
            **(metadata or {}),
            "step_count": step_count,
            "total_cost_usd": total_cost_usd,
            "total_tokens": total_tokens,
            "duration_ms": duration_ms,
        },
    )


def build_error_event(
    error: Exception,
    schema_type: SchemaType = SchemaType.ERROR,
    context_str: Optional[str] = None,
    metadata: Optional[dict[str, Any]] = None,
) -> ARLSEvent:
    """
    Build an ERROR event.

    Args:
        error: The exception that occurred
        schema_type: The schema type where the error occurred
        context_str: Optional context about where the error occurred
        metadata: Optional additional metadata

    Returns:
        A complete ARLSEvent of type ERROR
    """
    ctx = _get_or_create_context()
    increment_step()

    debug_hint = _generate_debug_hint(schema_type, error, context_str)

    return ARLSEvent(
        agentlens_version=ARLS_VERSION,
        schema_type=SchemaType.ERROR,
        timestamp=_now_iso8601(),
        trace_id=ctx.trace_id,
        run_id=ctx.run_id,
        step_index=ctx.step_index,
        agent=AgentContext(name=ctx.agent_name, phase=AgentPhase.IDLE),
        privacy=PrivacyData(pii_detected=False),
        semantic_tags=[],
        error=ErrorData(
            code=type(error).__name__,
            message=str(error),
            recoverable=True,
        ),
        ai_debug_hint=debug_hint,
        metadata={
            **(metadata or {}),
            "original_schema_type": schema_type.value,
            "context": context_str,
        },
    )
