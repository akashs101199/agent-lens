"""
AgentLens Core Package

Provides ARLS schema types, context propagation, event builders, and error classes.
"""

from agentlens_core.schema import (
    ARLS_VERSION,
    ARLSEvent,
    AgentContext,
    AgentPhase,
    CallStatus,
    ErrorData,
    LLMCallData,
    LLMProvider,
    MemoryData,
    PrivacyData,
    RedactionMode,
    SchemaType,
    ToolCallData,
)
from agentlens_core.errors import (
    AgentLensError,
    ContextError,
    InterceptorError,
    SchemaValidationError,
    TransportError,
)
from agentlens_core.context import (
    RunContext,
    create_run_context,
    get_run_context,
    run_in_context,
    increment_step,
)
from agentlens_core.event_builder import (
    build_llm_event,
    build_tool_event,
    build_agent_start_event,
    build_agent_end_event,
    build_error_event,
)
from agentlens_core import costs

__all__ = [
    # Schema types
    "ARLS_VERSION",
    "ARLSEvent",
    "AgentContext",
    "AgentPhase",
    "CallStatus",
    "ErrorData",
    "LLMCallData",
    "LLMProvider",
    "MemoryData",
    "PrivacyData",
    "RedactionMode",
    "SchemaType",
    "ToolCallData",
    # Error classes
    "AgentLensError",
    "ContextError",
    "InterceptorError",
    "SchemaValidationError",
    "TransportError",
    # Context functions
    "RunContext",
    "create_run_context",
    "get_run_context",
    "run_in_context",
    "increment_step",
    # Event builders
    "build_llm_event",
    "build_tool_event",
    "build_agent_start_event",
    "build_agent_end_event",
    "build_error_event",
    # Costs module
    "costs",
]
