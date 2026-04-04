# ARLS (AI-Readable Log Schema) Specification

**Version:** 1.0
**Status:** Stable
**License:** MIT

## Overview

ARLS is a versioned JSON schema for recording and analyzing AI agent behavior. It's designed to be:
- **Human-readable**: Developers can quickly understand what an agent did
- **AI-readable**: LLMs and AI dev tools can parse and reason about logs
- **Queryable**: Events can be filtered, searched, and analyzed programmatically
- **Privacy-first**: PII is redacted before logging

## Core Concepts

### Event

Every action an AI agent takes is recorded as an **Event** — a JSON object with:
- **Required fields**: Timestamp, event type, run ID, trace ID
- **Context**: Agent phase (PLAN, TOOL_CALL, OBSERVE, etc.)
- **Payload**: Event-specific data (LLM call details, tool output, etc.)
- **Privacy**: PII detection and redaction info

### Run

A **Run** is a complete execution of an agent. All events in a run share:
- **run_id**: Unique identifier for this execution
- **trace_id**: Trace identifier for debugging
- **step_index**: Sequential step number

### Trace

A **Trace** represents a logical chain of operations that can span multiple tools and LLM calls.

## Event Schema

```typescript
interface ARLSEvent {
  // Schema version (bump for breaking changes)
  agentlens_version: "1.0"

  // Type of event: what happened?
  schema_type:
    | "AGENT_START"        // Agent began execution
    | "AGENT_END"          // Agent completed
    | "LLM_CALL"           // Language model call
    | "TOOL_CALL"          // Tool/function call
    | "MEMORY_READ"        // Read from memory/context
    | "MEMORY_WRITE"       // Write to memory
    | "REASONING_STEP"     // Agent's reasoning
    | "ERROR"              // Error occurred
    | "COST_CHECKPOINT"    // Cost tracking

  // Timestamps and IDs
  timestamp: string                    // ISO 8601
  trace_id: string                     // Unique trace ID
  run_id: string                       // Unique run ID
  step_index: number                   // Sequence number

  // Who is acting and what phase?
  agent: {
    name: string                       // Agent name
    phase: "PLAN" | "TOOL_CALL" | "OBSERVE" | "REFLECT" | "RESPOND" | "IDLE"
    parent_decision?: string           // What prompted this step?
  }

  // Event-specific data (present if applicable)
  llm?: LLMCallData
  tool?: ToolCallData
  memory?: MemoryData
  error?: ErrorData

  // Privacy & metadata
  privacy: {
    pii_detected: boolean
    redacted_fields: string[]          // Which fields had PII?
    redaction_mode?: "MASK" | "HASH" | "DROP" | "PLACEHOLDER"
  }

  semantic_tags: string[]              // Tags for searching/filtering
  ai_debug_hint?: string               // Hints for AI analysis
  metadata?: Record<string, unknown>   // Custom metadata
}
```

## Event Types

### AGENT_START
Agent begins execution.
```typescript
{
  schema_type: "AGENT_START",
  agent: { name: "MyAgent", phase: "PLAN" }
}
```

### AGENT_END
Agent completes or terminates.
```typescript
{
  schema_type: "AGENT_END",
  metadata: { steps: 5, total_cost_usd: 0.0125 }
}
```

### LLM_CALL
Language model API call (Anthropic, OpenAI, etc).
```typescript
interface LLMCallData {
  model: string                    // e.g. "claude-3-5-sonnet-20241022"
  provider: string                 // "anthropic" | "openai" | etc
  prompt_tokens: number
  completion_tokens: number
  total_tokens: number
  cost_usd: number
  latency_ms: number
  finish_reason: string            // "end_turn", "max_tokens", etc
  time_to_first_token_ms?: number
}
```

### TOOL_CALL
Function or tool invocation.
```typescript
interface ToolCallData {
  name: string                     // Tool name
  input: Record<string, unknown>   // Arguments
  output: unknown                  // Result
  status: "SUCCESS" | "FAILURE" | "TIMEOUT" | "CANCELLED"
  duration_ms: number
  error_message?: string
}
```

### MEMORY_READ / MEMORY_WRITE
Agent reads from or writes to memory/context.
```typescript
interface MemoryData {
  context_window_used_pct?: number
  vector_db_reads?: number
  cache_hit?: boolean
  operation?: "READ" | "WRITE" | "INJECT"
  similarity_score?: number
}
```

### REASONING_STEP
Agent thinks through a step.
```typescript
{
  schema_type: "REASONING_STEP",
  metadata: { content: "Need to search for more context..." }
}
```

### ERROR
An error occurred during execution.
```typescript
interface ErrorData {
  code: string                     // Error code
  message: string
  stack?: string
  recoverable: boolean             // Can the agent recover?
  recovery_hint?: string           // What should happen next?
}
```

### COST_CHECKPOINT
Track total spend at key points.
```typescript
{
  schema_type: "COST_CHECKPOINT",
  metadata: { total_cost_usd: 0.0125, total_tokens: 1540 }
}
```

## Agent Phases

Agents typically move through these phases:

| Phase | Meaning |
|-------|---------|
| `PLAN` | Agent decides what to do next |
| `TOOL_CALL` | Agent calls a tool/function |
| `OBSERVE` | Agent observes tool output |
| `REFLECT` | Agent reasons about results |
| `RESPOND` | Agent formulates response |
| `IDLE` | Agent is waiting |

## Privacy & Redaction

Every event includes privacy metadata:

```typescript
privacy: {
  pii_detected: boolean,
  redacted_fields: ["email", "api_key"],
  redaction_mode: "MASK"
}
```

PII is detected for:
- Email addresses
- API keys (sk-, ak-, pk- prefixes)
- Credit cards (Luhn validated)
- Phone numbers (US format)
- Social security numbers
- Password fields

Redaction modes:
- **MASK**: Replace with `[REDACTED]`
- **HASH**: Replace with `[sha256:abc123...]`
- **DROP**: Omit completely
- **PLACEHOLDER**: Replace with `[EMAIL]`, `[API_KEY]`, etc.

## Querying ARLS Events

### Find all tool calls in a run
```typescript
events.filter(e => e.schema_type === "TOOL_CALL" && e.run_id === runId)
```

### Calculate total cost
```typescript
events
  .filter(e => e.llm)
  .reduce((sum, e) => sum + (e.llm?.cost_usd ?? 0), 0)
```

### Find errors
```typescript
events.filter(e => e.schema_type === "ERROR")
```

### Timeline of tool calls
```typescript
events
  .filter(e => e.schema_type === "TOOL_CALL")
  .map(e => ({
    timestamp: e.timestamp,
    tool: e.tool?.name,
    status: e.tool?.status,
    duration_ms: e.tool?.duration_ms
  }))
```

## Examples

### Simple LLM Call
```json
{
  "agentlens_version": "1.0",
  "schema_type": "LLM_CALL",
  "timestamp": "2024-04-04T12:34:56.789Z",
  "trace_id": "trace_abc123",
  "run_id": "run_20240404_xyz",
  "step_index": 1,
  "agent": {
    "name": "MyAgent",
    "phase": "PLAN"
  },
  "llm": {
    "model": "claude-3-5-sonnet-20241022",
    "provider": "anthropic",
    "prompt_tokens": 120,
    "completion_tokens": 40,
    "total_tokens": 160,
    "cost_usd": 0.0048,
    "latency_ms": 850,
    "finish_reason": "end_turn"
  },
  "privacy": {
    "pii_detected": false,
    "redacted_fields": []
  },
  "semantic_tags": ["planning", "main-decision"],
  "ai_debug_hint": "Model chose to search for more context"
}
```

### Tool Call with Error
```json
{
  "agentlens_version": "1.0",
  "schema_type": "TOOL_CALL",
  "timestamp": "2024-04-04T12:35:12.456Z",
  "trace_id": "trace_abc123",
  "run_id": "run_20240404_xyz",
  "step_index": 2,
  "agent": {
    "name": "MyAgent",
    "phase": "TOOL_CALL"
  },
  "tool": {
    "name": "web_search",
    "input": { "query": "AI observability" },
    "output": null,
    "status": "FAILURE",
    "duration_ms": 2100,
    "error_message": "Search service timeout"
  },
  "privacy": {
    "pii_detected": false,
    "redacted_fields": []
  },
  "semantic_tags": ["search", "failure"],
  "ai_debug_hint": "Tool timeout occurred, agent should retry or skip"
}
```

## Versioning

ARLS uses semantic versioning:
- **Major** (1.0 → 2.0): Breaking schema changes
- **Minor** (1.0 → 1.1): New optional fields
- **Patch** (1.0 → 1.0.1): Documentation/interpretation clarifications

Consumers should:
- Handle unknown `schema_type` values gracefully
- Ignore unknown fields (forward compatibility)
- Treat missing optional fields as null/undefined

## License

ARLS specification is released under the MIT License.
