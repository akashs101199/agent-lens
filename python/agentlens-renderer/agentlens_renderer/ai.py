"""
AI-readable output renderer for ARLS events.

Produces compact JSONL (one JSON object per line) with additional context
that makes it easy for Claude Code and other AI development tools to
understand what happened and suggest improvements.
"""

import json
from typing import Any

from agentlens_core import ARLSEvent, SchemaType, CallStatus


def render_ai(event: ARLSEvent) -> str:
    """
    Render an ARLS event as JSONL (one compact JSON line).

    Args:
        event: The ARLS event to render

    Returns:
        Single-line JSON string (JSONL format)
    """
    # Start with standard ARLS event dict
    event_dict = event.to_dict()

    # Add Claude-specific context
    claude_context = _generate_claude_context(event)
    if claude_context:
        event_dict['_claude_context'] = claude_context

    # Serialize to JSON (compact, no pretty-printing for JSONL format)
    return json.dumps(event_dict, separators=(',', ':'), ensure_ascii=True)


def _generate_claude_context(event: ARLSEvent) -> dict[str, Any]:
    """
    Generate Claude-specific debug context for an event.

    This helps Claude Code understand the event's significance and
    suggest improvements to agent behavior.

    Args:
        event: The ARLS event

    Returns:
        Dictionary with Claude context fields
    """
    context: dict[str, Any] = {}

    # Generate summary
    if event.schema_type == SchemaType.LLM_CALL and event.llm:
        context['summary'] = (
            f'LLM call to {event.llm.model} '
            f'returned {event.llm.completion_tokens} tokens '
            f'in {event.llm.latency_ms:.0f}ms'
        )
        context['cost_usd'] = event.llm.cost_usd

        # Add performance suggestion
        if event.llm.latency_ms > 5000:
            context['debug_suggestion'] = (
                'LLM call took >5s. Consider caching prompts or using faster models.'
            )
        elif event.llm.completion_tokens > 2000:
            context['debug_suggestion'] = (
                'High output token count. Consider constraining generation.'
            )

    elif event.schema_type == SchemaType.TOOL_CALL and event.tool:
        status_word = (
            'succeeded' if event.tool.status == CallStatus.SUCCESS else 'failed'
        )
        context['summary'] = (
            f'Tool {event.tool.name!r} {status_word} '
            f'in {event.tool.duration_ms:.0f}ms'
        )

        # Error context
        if event.tool.status == CallStatus.FAILURE:
            context['debug_suggestion'] = (
                f'Tool failed with: {event.tool.error_message}. '
                'Consider error handling or fallback logic.'
            )
        elif event.tool.duration_ms > 3000:
            context['debug_suggestion'] = (
                'Tool call was slow. Consider timeout or async optimization.'
            )

    elif event.schema_type == SchemaType.ERROR and event.error:
        context['summary'] = f'{event.error.code}: {event.error.message}'

        # Provide recovery suggestions
        if 'context' in (event.error.message.lower() or ''):
            context['debug_suggestion'] = (
                'Context overflow detected. '
                'Consider summarizing previous messages or using sliding window.'
            )
        elif 'timeout' in (event.error.message.lower() or ''):
            context['debug_suggestion'] = (
                'Operation timed out. '
                'Consider increasing timeout or optimizing the operation.'
            )
        elif event.error.recoverable:
            context['debug_suggestion'] = (
                'Error is recoverable. '
                'Consider implementing retry logic with exponential backoff.'
            )

    elif event.schema_type == SchemaType.AGENT_START:
        context['summary'] = f'Agent {event.agent.name} started execution'

    elif event.schema_type == SchemaType.AGENT_END:
        # Summary of entire run
        total_tokens = event.metadata.get('total_tokens', 0) if event.metadata else 0
        total_cost = event.metadata.get('total_cost_usd', 0) if event.metadata else 0
        step_count = event.metadata.get('step_count', 0) if event.metadata else 0

        context['summary'] = (
            f'Agent {event.agent.name} completed in {step_count} steps'
        )
        context['total_tokens'] = total_tokens
        context['total_cost_usd'] = total_cost

    # Add step reference
    context['step_index'] = event.step_index
    context['trace_id'] = event.trace_id[:12]  # Abbreviated trace ID

    # Add PII status if present
    if event.privacy.pii_detected:
        context['pii_redacted'] = len(event.privacy.redacted_fields) > 0
        context['redacted_field_count'] = len(event.privacy.redacted_fields)

    return context


def render_ai_compact(event: ARLSEvent) -> dict[str, Any]:
    """
    Render an ARLS event as a compact dictionary (not JSON string).

    Useful for programmatic access rather than JSONL output.

    Args:
        event: The ARLS event

    Returns:
        Dictionary representation of the event
    """
    event_dict = event.to_dict()
    claude_context = _generate_claude_context(event)
    if claude_context:
        event_dict['_claude_context'] = claude_context
    return event_dict
