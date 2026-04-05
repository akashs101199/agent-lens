"""
Human-readable terminal output renderer for ARLS events.

Uses the rich library to produce beautiful, colored terminal output that developers
are proud to look at.
"""

import os
from typing import Optional

from agentlens_core import ARLSEvent, SchemaType, AgentPhase, CallStatus


class Colors:
    """ANSI color codes for terminal output."""

    # Text colors
    BLACK = '\033[30m'
    RED = '\033[31m'
    GREEN = '\033[32m'
    YELLOW = '\033[33m'
    BLUE = '\033[34m'
    MAGENTA = '\033[35m'
    CYAN = '\033[36m'
    WHITE = '\033[37m'

    # Bright colors
    BRIGHT_BLACK = '\033[90m'
    BRIGHT_RED = '\033[91m'
    BRIGHT_GREEN = '\033[92m'
    BRIGHT_YELLOW = '\033[93m'
    BRIGHT_BLUE = '\033[94m'
    BRIGHT_MAGENTA = '\033[95m'
    BRIGHT_CYAN = '\033[96m'
    BRIGHT_WHITE = '\033[97m'

    # Styles
    BOLD = '\033[1m'
    DIM = '\033[2m'
    ITALIC = '\033[3m'
    UNDERLINE = '\033[4m'
    RESET = '\033[0m'


class Emoji:
    """Emoji for event types and status indicators."""

    # Event types
    AGENT_START = '🤖'
    AGENT_END = '🏁'
    LLM_CALL = '🧠'
    TOOL_CALL = '🔧'
    REASONING = '💭'
    MEMORY_READ = '📖'
    MEMORY_WRITE = '💾'
    ERROR = '❌'

    # Status indicators
    SUCCESS = '✅'
    FAILURE = '❌'
    TIMEOUT = '⏰'
    CANCELLED = '⛔'

    # Phases
    PLAN = '📋'
    OBSERVE = '👁'
    REFLECT = '💭'
    RESPOND = '💬'


def _should_use_color() -> bool:
    """
    Determine if terminal supports color.

    Respects NO_COLOR environment variable.
    """
    if os.environ.get('NO_COLOR'):
        return False
    if os.environ.get('CI'):
        return False
    return True


def _format_duration(ms: float) -> str:
    """Format milliseconds as human-readable duration."""
    if ms < 1000:
        return f'{ms:.0f}ms'
    elif ms < 60000:
        return f'{ms / 1000:.2f}s'
    else:
        return f'{ms / 60000:.2f}m'


def _format_tokens(count: int) -> str:
    """Format token count as human-readable."""
    if count < 1000:
        return str(count)
    elif count < 1_000_000:
        return f'{count / 1000:.1f}K'
    else:
        return f'{count / 1_000_000:.1f}M'


def _format_cost(usd: float) -> str:
    """Format USD cost as human-readable."""
    if usd == 0:
        return '$0.00'
    elif usd < 0.01:
        return f'${usd:.4f}'
    else:
        return f'${usd:.2f}'


def render_human(
    event: ARLSEvent,
    use_color: bool = True,
) -> str:
    """
    Render an ARLS event as human-readable terminal output.

    Args:
        event: The ARLS event to render
        use_color: Whether to use terminal colors (respects NO_COLOR)

    Returns:
        Formatted string ready for terminal output
    """
    if not use_color or not _should_use_color():
        use_color = False

    output_lines: list[str] = []

    # Header with run info
    if event.schema_type in [SchemaType.AGENT_START, SchemaType.AGENT_END]:
        header = f'{Emoji.AGENT_START} {event.agent.name}'
        if use_color:
            header = f'{Colors.BRIGHT_CYAN}{header}{Colors.RESET}'
        output_lines.append(header)
        output_lines.append(f'   run_id: {event.run_id}  ·  trace_id: {event.trace_id}')

    # LLM Call
    if event.schema_type == SchemaType.LLM_CALL and event.llm:
        emoji = Emoji.LLM_CALL
        model = event.llm.model
        line = f'{emoji} LLM CALL  step {event.step_index}  →  {model}'

        if use_color:
            line = f'{Colors.BRIGHT_BLUE}{line}{Colors.RESET}'
        output_lines.append(line)

        # Token details
        tokens_line = (
            f'   tokens: {_format_tokens(event.llm.total_tokens)} '
            f'({_format_tokens(event.llm.prompt_tokens)} in / '
            f'{_format_tokens(event.llm.completion_tokens)} out)'
        )
        output_lines.append(tokens_line)

        # Cost
        cost_line = f'   cost:   {_format_cost(event.llm.cost_usd)}'
        output_lines.append(cost_line)

        # Latency and finish reason
        detail_line = (
            f'   ⏱  {_format_duration(event.llm.latency_ms)}  ·  '
            f'finish: {event.llm.finish_reason}'
        )
        output_lines.append(detail_line)

    # Tool Call
    elif event.schema_type == SchemaType.TOOL_CALL and event.tool:
        emoji = Emoji.TOOL_CALL
        tool_name = event.tool.name
        status_emoji = (
            Emoji.SUCCESS if event.tool.status == CallStatus.SUCCESS else Emoji.FAILURE
        )
        line = f'{emoji} TOOL CALL  step {event.step_index}  →  {tool_name}'

        if use_color:
            line = f'{Colors.BRIGHT_YELLOW}{line}{Colors.RESET}'
        output_lines.append(line)

        # Input/Output (abbreviated)
        if event.tool.input:
            input_str = str(event.tool.input)[:60]
            output_lines.append(f'   input:  {input_str}')

        if event.tool.output:
            output_str = str(event.tool.output)[:60]
            output_lines.append(f'   output: {output_str}')

        # Status and duration
        status_line = f'   {status_emoji} {event.tool.status.value}  {_format_duration(event.tool.duration_ms)}'
        output_lines.append(status_line)

        # Error message if present
        if event.tool.error_message:
            if use_color:
                error_line = f'{Colors.RED}   Error: {event.tool.error_message}{Colors.RESET}'
            else:
                error_line = f'   Error: {event.tool.error_message}'
            output_lines.append(error_line)

    # Error Event
    elif event.schema_type == SchemaType.ERROR and event.error:
        emoji = Emoji.ERROR
        code = event.error.code
        message = event.error.message

        if use_color:
            line = f'{Colors.BRIGHT_RED}{emoji} ERROR  {code}{Colors.RESET}'
        else:
            line = f'{emoji} ERROR  {code}'
        output_lines.append(line)

        output_lines.append(f'   {message}')

        if event.error.stack:
            output_lines.append(f'   Stack: {event.error.stack[:100]}...')

    # Semantic tags if present
    if event.semantic_tags:
        tags_line = f'   tags: {", ".join(event.semantic_tags)}'
        if use_color:
            tags_line = f'{Colors.DIM}{tags_line}{Colors.RESET}'
        output_lines.append(tags_line)

    # Privacy info if PII was detected
    if event.privacy.pii_detected:
        pii_line = f'   ⚠️  PII redacted: {", ".join(event.privacy.redacted_fields)}'
        if use_color:
            pii_line = f'{Colors.BRIGHT_YELLOW}{pii_line}{Colors.RESET}'
        output_lines.append(pii_line)

    return '\n'.join(output_lines)


def render_human_compact(event: ARLSEvent) -> str:
    """
    Render an ARLS event in compact single-line format.

    Args:
        event: The ARLS event to render

    Returns:
        Single-line formatted string
    """
    if event.schema_type == SchemaType.LLM_CALL and event.llm:
        return (
            f'{Emoji.LLM_CALL} LLM {event.llm.model} '
            f'{_format_tokens(event.llm.total_tokens)} tokens '
            f'{_format_cost(event.llm.cost_usd)} '
            f'{_format_duration(event.llm.latency_ms)}'
        )

    elif event.schema_type == SchemaType.TOOL_CALL and event.tool:
        status_emoji = (
            Emoji.SUCCESS if event.tool.status == CallStatus.SUCCESS else Emoji.FAILURE
        )
        return (
            f'{Emoji.TOOL_CALL} {event.tool.name} {status_emoji} '
            f'{_format_duration(event.tool.duration_ms)}'
        )

    elif event.schema_type == SchemaType.AGENT_START:
        return f'{Emoji.AGENT_START} {event.agent.name} started'

    elif event.schema_type == SchemaType.AGENT_END:
        return f'{Emoji.AGENT_END} {event.agent.name} finished'

    elif event.schema_type == SchemaType.ERROR and event.error:
        return f'{Emoji.ERROR} {event.error.code}: {event.error.message[:50]}'

    else:
        return f'📌 {event.schema_type.value}'
