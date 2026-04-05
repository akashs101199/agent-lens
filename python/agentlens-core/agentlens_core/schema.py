"""
AI-Readable Log Schema (ARLS) v1.0 - Python implementation

This file is code-generated from packages/core/src/schema.ts.
Do not edit manually. Run: pnpm codegen:python
"""

from dataclasses import dataclass, field
from typing import Any, Literal, Optional
from enum import Enum

ARLS_VERSION = "1.0"


# Enums
class SchemaType(str, Enum):
    """All possible schema_type values for a log event."""
    AGENT_START = "AGENT_START"
    AGENT_END = "AGENT_END"
    LLM_CALL = "LLM_CALL"
    TOOL_CALL = "TOOL_CALL"
    MEMORY_READ = "MEMORY_READ"
    MEMORY_WRITE = "MEMORY_WRITE"
    REASONING_STEP = "REASONING_STEP"
    ERROR = "ERROR"
    COST_CHECKPOINT = "COST_CHECKPOINT"


class AgentPhase(str, Enum):
    """Agent execution phase at the time of the event."""
    PLAN = "PLAN"
    TOOL_CALL = "TOOL_CALL"
    OBSERVE = "OBSERVE"
    REFLECT = "REFLECT"
    RESPOND = "RESPOND"
    IDLE = "IDLE"


class RedactionMode(str, Enum):
    """PII redaction mode."""
    MASK = "MASK"
    HASH = "HASH"
    DROP = "DROP"
    PLACEHOLDER = "PLACEHOLDER"


class CallStatus(str, Enum):
    """Tool call / LLM call completion status."""
    SUCCESS = "SUCCESS"
    FAILURE = "FAILURE"
    TIMEOUT = "TIMEOUT"
    CANCELLED = "CANCELLED"


# Type aliases
LLMProvider = str


# Dataclasses

@dataclass
class AgentContext:
    """Agent context embedded in every event."""
    name: str
    phase: AgentPhase
    parent_decision: Optional[str] = None


@dataclass
class LLMCallData:
    """LLM call data — present when schema_type is LLM_CALL."""
    model: str
    provider: LLMProvider
    prompt_tokens: int
    completion_tokens: int
    total_tokens: int
    cost_usd: float
    latency_ms: float
    finish_reason: str
    time_to_first_token_ms: Optional[float] = None


@dataclass
class ToolCallData:
    """Tool call data — present when schema_type is TOOL_CALL."""
    name: str
    input: dict[str, Any]
    output: Any
    status: CallStatus
    duration_ms: float
    error_message: Optional[str] = None


@dataclass
class MemoryData:
    """Memory operation data."""
    context_window_used_pct: Optional[float] = None
    vector_db_reads: Optional[int] = None
    cache_hit: Optional[bool] = None
    operation: Optional[Literal["READ", "WRITE", "INJECT"]] = None
    similarity_score: Optional[float] = None


@dataclass
class PrivacyData:
    """Privacy metadata."""
    pii_detected: bool
    redacted_fields: list[str] = field(default_factory=list)
    redaction_mode: Optional[RedactionMode] = None


@dataclass
class ErrorData:
    """Error data — present when schema_type is ERROR."""
    code: str
    message: str
    stack: Optional[str] = None
    recoverable: bool = True
    recovery_hint: Optional[str] = None


@dataclass
class ARLSEvent:
    """
    A single ARLS-compliant log event.
    This is the canonical shape of every event AgentLens produces.
    """
    agentlens_version: str
    schema_type: SchemaType
    timestamp: str  # ISO 8601
    trace_id: str
    run_id: str
    step_index: int
    agent: AgentContext
    privacy: PrivacyData
    semantic_tags: list[str] = field(default_factory=list)
    llm: Optional[LLMCallData] = None
    tool: Optional[ToolCallData] = None
    memory: Optional[MemoryData] = None
    error: Optional[ErrorData] = None
    ai_debug_hint: Optional[str] = None
    metadata: Optional[dict[str, Any]] = None

    def __post_init__(self) -> None:
        """Validate that version matches ARLS_VERSION."""
        if self.agentlens_version != ARLS_VERSION:
            raise ValueError(
                f"Invalid ARLS version: {self.agentlens_version}. "
                f"Expected {ARLS_VERSION}"
            )

    def to_dict(self) -> dict[str, Any]:
        """Convert event to dictionary for JSON serialization."""
        return {
            "agentlens_version": self.agentlens_version,
            "schema_type": self.schema_type.value,
            "timestamp": self.timestamp,
            "trace_id": self.trace_id,
            "run_id": self.run_id,
            "step_index": self.step_index,
            "agent": {
                "name": self.agent.name,
                "phase": self.agent.phase.value,
                "parent_decision": self.agent.parent_decision,
            },
            "privacy": {
                "pii_detected": self.privacy.pii_detected,
                "redacted_fields": self.privacy.redacted_fields,
                "redaction_mode": self.privacy.redaction_mode.value if self.privacy.redaction_mode else None,
            },
            "semantic_tags": self.semantic_tags,
            "llm": self._dataclass_to_dict(self.llm) if self.llm else None,
            "tool": self._dataclass_to_dict(self.tool) if self.tool else None,
            "memory": self._dataclass_to_dict(self.memory) if self.memory else None,
            "error": self._dataclass_to_dict(self.error) if self.error else None,
            "ai_debug_hint": self.ai_debug_hint,
            "metadata": self.metadata,
        }

    @staticmethod
    def _dataclass_to_dict(obj: Any) -> Optional[dict[str, Any]]:
        """Recursively convert dataclass to dict, handling enums."""
        if obj is None:
            return None
        result: dict[str, Any] = {}
        for k, v in obj.__dict__.items():
            if isinstance(v, Enum):
                result[k] = v.value
            elif hasattr(v, '__dict__') and not isinstance(v, (str, int, float, bool, list, dict)):
                result[k] = ARLSEvent._dataclass_to_dict(v)
            else:
                result[k] = v
        return result
