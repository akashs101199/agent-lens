"""
AgentLens — AI agent observability through structured logging.

This is the main public API that orchestrates all components.
"""

import asyncio
from typing import Any, Callable, Optional, TypeVar

from agentlens_core import (
    ARLSEvent,
    AgentContext,
    AgentPhase,
    RedactionMode,
    SchemaType,
    create_run_context,
    get_run_context,
    increment_step,
    run_in_context,
    RunContext,
)
from agentlens_interceptors import (
    AgentLensCallbackHandler,
    wrap_anthropic,
    wrap_openai,
    wrap_tool,
)
from agentlens_privacy import redact_event
from agentlens_renderer import render_ai, render_human
from agentlens_transport import (
    ConsoleTransport,
    FileTransport,
    Transport,
    TransportConfig,
)

__all__ = [
    'AgentLens',
    'AgentLensConfig',
    'AgentRun',
    'AgentLensCallbackHandler',
]

T = TypeVar('T')


class AgentRun:
    """Represents an active agent run with context."""

    def __init__(self, context: RunContext, agent_lens: 'AgentLens') -> None:
        """
        Initialize an active agent run.

        Args:
            context: The run context (run_id, trace_id, step_index)
            agent_lens: Parent AgentLens instance
        """
        self.context = context
        self._agent_lens = agent_lens

    async def __aenter__(self) -> 'AgentRun':
        """Async context manager entry."""
        return self

    async def __aexit__(self, exc_type: object, exc_val: object, exc_tb: object) -> None:
        """Async context manager exit."""
        await self._agent_lens.close()


class AgentLensConfig:
    """Configuration for AgentLens."""

    def __init__(
        self,
        agent: str,
        mode: str = 'human',
        transport: str = 'console',
        file_path: Optional[str] = None,
        privacy_enabled: bool = True,
        redaction_mode: str = 'MASK',
        max_queue_size: int = 1000,
        flush_interval_seconds: float = 5.0,
    ) -> None:
        """
        Initialize AgentLens configuration.

        Args:
            agent: Agent name for logging
            mode: Output mode ('human', 'ai', or 'both')
            transport: Transport type ('console', 'file')
            file_path: File path for file transport
            privacy_enabled: Enable PII redaction
            redaction_mode: Redaction mode (MASK, HASH, DROP, PLACEHOLDER)
            max_queue_size: Max events in transport queue
            flush_interval_seconds: Background flush interval
        """
        self.agent = agent
        self.mode = mode
        self.transport = transport
        self.file_path = file_path
        self.privacy_enabled = privacy_enabled
        self.redaction_mode = redaction_mode
        self.max_queue_size = max_queue_size
        self.flush_interval_seconds = flush_interval_seconds


class AgentLens:
    """
    Main public API for AgentLens observability.

    Orchestrates schema, context propagation, interceptors, privacy,
    rendering, and transport.
    """

    def __init__(self, config: AgentLensConfig) -> None:
        """
        Initialize AgentLens.

        Args:
            config: AgentLens configuration
        """
        self.config = config
        self._context: Optional[RunContext] = None
        self._transport: Transport
        self._privacy_enabled = config.privacy_enabled
        self._redaction_mode: RedactionMode

        # Parse redaction mode
        if config.redaction_mode == 'MASK':
            self._redaction_mode = RedactionMode.MASK
        elif config.redaction_mode == 'HASH':
            self._redaction_mode = RedactionMode.HASH
        elif config.redaction_mode == 'DROP':
            self._redaction_mode = RedactionMode.DROP
        elif config.redaction_mode == 'PLACEHOLDER':
            self._redaction_mode = RedactionMode.PLACEHOLDER
        else:
            self._redaction_mode = RedactionMode.MASK

        # Initialize transport
        transport_config = TransportConfig(
            max_queue_size=config.max_queue_size,
            flush_interval_seconds=config.flush_interval_seconds,
        )

        if config.transport == 'file':
            if not config.file_path:
                raise ValueError(
                    'file_path must be provided when transport is "file"'
                )
            self._transport = FileTransport(config.file_path, config=transport_config)
        else:  # default to console
            self._transport = ConsoleTransport(config=transport_config)

    def wrap(self, client: Any) -> Any:
        """
        Wrap an SDK client for automatic logging.

        Supports Anthropic and OpenAI clients.

        Args:
            client: An SDK client instance

        Returns:
            The wrapped client
        """
        client_type = type(client).__name__

        if client_type == 'Anthropic':
            return wrap_anthropic(client)
        elif client_type == 'OpenAI':
            return wrap_openai(client)
        else:
            raise ValueError(
                f'Unsupported client type: {client_type}. '
                'Supported clients: Anthropic, OpenAI'
            )

    def wrap_tool(
        self,
        name: str,
        fn: Callable[..., Any],
    ) -> Callable[..., Any]:
        """
        Wrap an async function as a traced tool call.

        Input, output, duration, and status are automatically logged.

        Args:
            name: Tool name for logging
            fn: Async function to wrap

        Returns:
            Wrapped function with same signature and return type
        """
        return wrap_tool(name, fn)

    def start_run(self, name: Optional[str] = None) -> AgentRun:
        """
        Start an explicit agent run with context.

        All subsequent events will inherit this run's context until
        the run is closed.

        Args:
            name: Optional agent name (overrides config agent)

        Returns:
            AgentRun context manager
        """
        agent_name = name or self.config.agent
        self._context = create_run_context(agent_name)
        return AgentRun(self._context, self)

    def log(
        self,
        schema_type: str,
        agent_phase: str = 'IDLE',
        metadata: Optional[dict[str, Any]] = None,
    ) -> None:
        """
        Manually log an event at any phase.

        Args:
            schema_type: ARLS schema type (AGENT_START, LLM_CALL, etc.)
            agent_phase: Current agent phase (PLAN, TOOL_CALL, OBSERVE, etc.)
            metadata: Optional metadata dict
        """
        # Convert strings to enums
        try:
            schema_type_enum = SchemaType(schema_type)
        except (ValueError, KeyError):
            schema_type_enum = SchemaType.AGENT_START

        try:
            agent_phase_enum = AgentPhase(agent_phase)
        except (ValueError, KeyError):
            agent_phase_enum = AgentPhase.IDLE

        context = get_run_context()
        if not context:
            context = create_run_context(self.config.agent)

        # Create event
        event = ARLSEvent(
            agentlens_version='1.0',
            schema_type=schema_type_enum,
            timestamp='',
            trace_id=context.trace_id,
            run_id=context.run_id,
            step_index=context.step_index,
            agent=AgentContext(name=self.config.agent, phase=agent_phase_enum),
            privacy={'pii_detected': False, 'redacted_fields': []},  # type: ignore[arg-type]
            semantic_tags=[],
            metadata=metadata or {},
        )

        # Apply privacy redaction if enabled
        if self._privacy_enabled:
            event = redact_event(event, self._redaction_mode)

        # Render based on mode
        rendered = ''
        if self.config.mode in ('human', 'both'):
            rendered = render_human(event)
        if self.config.mode in ('ai', 'both'):
            rendered = render_ai(event)

        # Queue for transport (non-blocking)
        try:
            loop = asyncio.get_event_loop()
            if loop.is_running():
                # In async context, create task for write
                asyncio.create_task(self._transport.write(event, rendered))
            else:
                # Not in async context, run synchronously
                loop.run_until_complete(self._transport.write(event, rendered))
        except RuntimeError:
            # No event loop, create one
            asyncio.run(self._transport.write(event, rendered))

    async def flush(self) -> None:
        """
        Flush all pending transport writes.

        Waits until all queued events are written before returning.
        """
        await self._transport.flush()

    async def close(self) -> None:
        """
        Close AgentLens and release all resources.

        Calls flush() before closing, ensuring no events are lost.
        """
        await self._transport.close()
