/**
 * ARLS (AI-Readable Log Schema) — the canonical schema for all AgentLens events.
 * This is the single source of truth for log event structure.
 */

/** ARLS schema version — bump minor for additions, major for breaking changes */
export const ARLS_VERSION = '1.0' as const

/** All possible schema_type values for a log event */
export type SchemaType =
  | 'AGENT_START'
  | 'AGENT_END'
  | 'LLM_CALL'
  | 'TOOL_CALL'
  | 'MEMORY_READ'
  | 'MEMORY_WRITE'
  | 'REASONING_STEP'
  | 'ERROR'
  | 'COST_CHECKPOINT'

/** Agent execution phase at the time of the event */
export type AgentPhase = 'PLAN' | 'TOOL_CALL' | 'OBSERVE' | 'REFLECT' | 'RESPOND' | 'IDLE'

/** PII redaction mode */
export type RedactionMode = 'MASK' | 'HASH' | 'DROP' | 'PLACEHOLDER'

/** Tool call / LLM call completion status */
export type CallStatus = 'SUCCESS' | 'FAILURE' | 'TIMEOUT' | 'CANCELLED'

/** LLM provider identifier */
export type LLMProvider = 'anthropic' | 'openai' | 'google' | 'cohere' | 'litellm' | string

/** Agent context embedded in every event */
export interface AgentContext {
  name: string
  phase: AgentPhase
  parent_decision?: string
}

/** LLM call data — present when schema_type is LLM_CALL */
export interface LLMCallData {
  model: string
  provider: LLMProvider
  prompt_tokens: number
  completion_tokens: number
  total_tokens: number
  cost_usd: number
  latency_ms: number
  finish_reason: string
  time_to_first_token_ms?: number
}

/** Tool call data — present when schema_type is TOOL_CALL */
export interface ToolCallData {
  name: string
  input: Record<string, unknown>
  output: unknown
  status: CallStatus
  duration_ms: number
  error_message?: string
}

/** Memory operation data */
export interface MemoryData {
  context_window_used_pct?: number
  vector_db_reads?: number
  cache_hit?: boolean
  operation?: 'READ' | 'WRITE' | 'INJECT'
  similarity_score?: number
}

/** Privacy metadata */
export interface PrivacyData {
  pii_detected: boolean
  redacted_fields: string[]
  redaction_mode?: RedactionMode
}

/** Error data — present when schema_type is ERROR */
export interface ErrorData {
  code: string
  message: string
  stack?: string
  recoverable: boolean
  recovery_hint?: string
}

/**
 * A single ARLS-compliant log event.
 * This is the canonical shape of every event AgentLens produces.
 */
export interface ARLSEvent {
  agentlens_version: typeof ARLS_VERSION
  schema_type: SchemaType
  timestamp: string // ISO 8601
  trace_id: string
  run_id: string
  step_index: number
  agent: AgentContext
  llm?: LLMCallData
  tool?: ToolCallData
  memory?: MemoryData
  privacy: PrivacyData
  semantic_tags: string[]
  error?: ErrorData
  ai_debug_hint?: string
  metadata?: Record<string, unknown>
}
