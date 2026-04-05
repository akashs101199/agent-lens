import { ARLS_VERSION, ARLSEvent, AgentPhase, SchemaType, LLMCallData, ToolCallData, ErrorData } from './schema.js'
import { getRunContext, createRunContext, incrementStep } from './context.js'

/**
 * Input data for building an LLM call event.
 */
export interface LLMCallInput {
  model: string
  provider: string
  prompt_tokens: number
  completion_tokens: number
  cost_usd: number
  latency_ms: number
  finish_reason: string
  time_to_first_token_ms?: number
}

/**
 * Input data for building a tool call event.
 */
export interface ToolCallInput {
  name: string
  input: Record<string, unknown>
  output: unknown
  status: 'SUCCESS' | 'FAILURE' | 'TIMEOUT' | 'CANCELLED'
  duration_ms: number
  error_message?: string
}

/**
 * Input data for building an agent end event.
 */
export interface AgentEndSummary {
  summary: string
  total_tokens?: number
  total_cost_usd?: number
  duration_ms?: number
}

/**
 * Builds a base ARLS event with common fields.
 */
function buildBaseEvent(schema_type: SchemaType): ARLSEvent {
  const ctx = getRunContext() ?? createRunContext('unknown')

  return {
    agentlens_version: ARLS_VERSION,
    schema_type,
    timestamp: new Date().toISOString(),
    trace_id: ctx.trace_id,
    run_id: ctx.run_id,
    step_index: ctx.step_index,
    agent: {
      name: 'unknown',
      phase: 'IDLE',
    },
    privacy: {
      pii_detected: false,
      redacted_fields: [],
    },
    semantic_tags: [],
  }
}

/**
 * Detects common error patterns and returns an appropriate ai_debug_hint.
 */
function detectDebugHint(code: string, message: string): string | undefined {
  if (code.includes('CONTEXT') || message.toLowerCase().includes('context')) {
    return 'CONTEXT_OVERFLOW: Model context window exceeded. Consider summarizing or chunking inputs.'
  }
  if (code.includes('TOOL') || message.toLowerCase().includes('tool')) {
    return 'TOOL_FAILURE: Tool call failed. Check tool parameters and availability.'
  }
  if (code.includes('LOOP') || message.toLowerCase().includes('loop')) {
    return 'LOOP_DETECTED: Agent appears stuck in a loop. Consider adding loop detection logic.'
  }
  return undefined
}

/**
 * Sanitizes a stack trace by removing file paths and module names.
 * Keeps only function names, line numbers, and column numbers for debugging.
 * This prevents leaking internal code structure and file system paths.
 *
 * @param stack - The stack trace string to sanitize
 * @returns Sanitized stack trace with paths removed
 * @internal
 */
function sanitizeStackTrace(stack: string): string {
  // Split into lines
  const lines = stack.split('\n')

  // Process each line: keep function name and position, remove full paths
  return lines
    .map((line) => {
      // Pattern: "  at functionName (/full/path/to/file.ts:123:45)"
      // Replace full paths with just filename:line:column
      return line.replace(/\(\/[^)]*\/([^/]+):(\d+):(\d+)\)/, '($1:$2:$3)').replace(/\/[^)]*\/([^/:]+):(\d+):(\d+)/g, '$1:$2:$3')
    })
    .join('\n')
}

/**
 * Builds an LLM_CALL event from call data.
 */
export function buildLLMEvent(data: LLMCallInput, agentName: string = 'unknown', phase: AgentPhase = 'IDLE'): ARLSEvent {
  const event = buildBaseEvent('LLM_CALL')
  event.agent.name = agentName
  event.agent.phase = phase
  incrementStep()

  const llmData: LLMCallData = {
    model: data.model,
    provider: data.provider,
    prompt_tokens: data.prompt_tokens,
    completion_tokens: data.completion_tokens,
    total_tokens: data.prompt_tokens + data.completion_tokens,
    cost_usd: data.cost_usd,
    latency_ms: data.latency_ms,
    finish_reason: data.finish_reason,
  }

  if (data.time_to_first_token_ms !== undefined) {
    llmData.time_to_first_token_ms = data.time_to_first_token_ms
  }

  event.llm = llmData

  return event
}

/**
 * Builds a TOOL_CALL event from tool call data.
 */
export function buildToolEvent(data: ToolCallInput, agentName: string = 'unknown', phase: AgentPhase = 'IDLE'): ARLSEvent {
  const event = buildBaseEvent('TOOL_CALL')
  event.agent.name = agentName
  event.agent.phase = phase
  incrementStep()

  const toolData: ToolCallData = {
    name: data.name,
    input: data.input,
    output: data.output,
    status: data.status,
    duration_ms: data.duration_ms,
  }

  if (data.error_message !== undefined) {
    toolData.error_message = data.error_message
  }

  event.tool = toolData

  return event
}

/**
 * Builds an AGENT_START event.
 */
export function buildAgentStartEvent(name: string, phase: AgentPhase = 'PLAN'): ARLSEvent {
  const event = buildBaseEvent('AGENT_START')
  event.agent.name = name
  event.agent.phase = phase
  return event
}

/**
 * Builds an AGENT_END event.
 */
export function buildAgentEndEvent(summary: AgentEndSummary, agentName: string = 'unknown'): ARLSEvent {
  const event = buildBaseEvent('AGENT_END')
  event.agent.name = agentName
  event.agent.phase = 'IDLE'

  event.metadata = {
    summary: summary.summary,
    total_tokens: summary.total_tokens,
    total_cost_usd: summary.total_cost_usd,
    duration_ms: summary.duration_ms,
  }

  return event
}

/**
 * Builds an ERROR event from an error object.
 */
export function buildErrorEvent(error: unknown, context: string = 'unknown', agentName: string = 'unknown'): ARLSEvent {
  const event = buildBaseEvent('ERROR')
  event.agent.name = agentName
  event.agent.phase = 'IDLE'
  incrementStep()

  let code = 'UNKNOWN_ERROR'
  let message = 'An unknown error occurred'
  let stack: string | undefined
  let recoverable = true

  if (error instanceof Error) {
    message = error.message
    stack = error.stack
    if ('code' in error && typeof error.code === 'string') {
      code = error.code
    }
    if ('recoverable' in error && typeof error.recoverable === 'boolean') {
      recoverable = error.recoverable
    }
  } else if (typeof error === 'string') {
    message = error
  } else if (error && typeof error === 'object') {
    if ('message' in error && typeof error.message === 'string') {
      message = error.message
    }
    if ('code' in error && typeof error.code === 'string') {
      code = error.code
    }
    if ('recoverable' in error && typeof error.recoverable === 'boolean') {
      recoverable = error.recoverable
    }
  }

  const errorData: ErrorData = {
    code,
    message,
    recoverable,
  }

  if (stack !== undefined) {
    // Sanitize stack trace to remove file paths and sensitive information
    errorData.stack = sanitizeStackTrace(stack)
  }

  if (context !== 'unknown') {
    errorData.recovery_hint = context
  }

  event.error = errorData

  const debugHint = detectDebugHint(code, message)
  if (debugHint !== undefined) {
    event.ai_debug_hint = debugHint
  }

  return event
}
