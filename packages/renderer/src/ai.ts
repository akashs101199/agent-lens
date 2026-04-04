import type { ARLSEvent } from '@agentlens/core'

interface ClaudeContext {
  summary: string
  debug_suggestion?: string
  related_steps?: number[]
  cost_so_far_usd?: number
}

/** AI-mode specific event with Claude context */
interface AIEvent extends ARLSEvent {
  _claude_context: ClaudeContext
}

/** Generate a summary for the Claude context based on event type */
function generateSummary(event: ARLSEvent): string {
  switch (event.schema_type) {
    case 'AGENT_START':
      return `Agent '${event.agent.name}' started execution (run: ${event.run_id})`

    case 'AGENT_END':
      return `Agent '${event.agent.name}' completed execution after ${event.step_index} steps`

    case 'TOOL_CALL': {
      if (!event.tool) return 'Tool call event'
      const duration = (event.tool.duration_ms / 1000).toFixed(2)
      return `Tool '${event.tool.name}' ${event.tool.status.toLowerCase()} in ${duration}s`
    }

    case 'LLM_CALL': {
      if (!event.llm) return 'LLM call event'
      return `LLM call to ${event.llm.model} used ${event.llm.total_tokens} tokens (${event.llm.prompt_tokens} in / ${event.llm.completion_tokens} out)`
    }

    case 'ERROR': {
      if (!event.error) return 'Error event'
      return `Error [${event.error.code}]: ${event.error.message}`
    }

    case 'REASONING_STEP':
      return `Reasoning step by ${event.agent.name} in phase ${event.agent.phase}`

    case 'MEMORY_READ':
      return `Memory read operation (context usage: ${event.memory?.context_window_used_pct ?? 0}%)`

    case 'MEMORY_WRITE':
      return `Memory write operation (context usage: ${event.memory?.context_window_used_pct ?? 0}%)`

    case 'COST_CHECKPOINT': {
      const cost = event.metadata?.total_cost_usd
      return `Cost checkpoint: total spend ${cost ? `$${Number(cost).toFixed(4)}` : 'unknown'}`
    }

    default:
      return `${event.schema_type} event at step ${event.step_index}`
  }
}

/** Generate debug suggestions for common patterns */
function generateDebugSuggestion(event: ARLSEvent): string | undefined {
  if (event.schema_type === 'TOOL_CALL' && event.tool) {
    if (event.tool.status === 'FAILURE') {
      return `Tool failed with: ${event.tool.error_message || 'unknown error'}. Consider retrying with different input or adding error handling.`
    }
    if (event.tool.duration_ms > 5000) {
      return `Tool took ${(event.tool.duration_ms / 1000).toFixed(2)}s to complete. Consider implementing caching or optimizing the tool implementation.`
    }
  }

  if (event.schema_type === 'ERROR') {
    if (event.error?.code === 'CONTEXT_OVERFLOW') {
      return 'Context window exceeded. Consider summarizing earlier messages or implementing context management.'
    }
    if (event.error?.code === 'LOOP_DETECTED') {
      return 'Agent appears to be in a loop. Check decision logic and tool outputs.'
    }
  }

  if (event.ai_debug_hint) {
    return event.ai_debug_hint
  }

  return undefined
}

/**
 * Render a single ARLS event as JSON with Claude-specific metadata for AI tools.
 * Output is JSONL format (one compact JSON object per line, no pretty-printing).
 *
 * @param event - The ARLS event to render
 * @returns Compact JSON string suitable for Claude Code or Copilot
 *
 * @example
 * const event = buildLLMEvent({ ... })
 * const json = renderEventAI(event)
 * console.log(json) // outputs one JSON line
 */
export function renderEventAI(event: ARLSEvent): string {
  const claudeContext: ClaudeContext = {
    summary: generateSummary(event),
  }

  const debugSuggestion = generateDebugSuggestion(event)
  if (debugSuggestion !== undefined) {
    claudeContext.debug_suggestion = debugSuggestion
  }

  const relatedSteps = event.metadata?.related_steps as number[] | undefined
  if (relatedSteps !== undefined) {
    claudeContext.related_steps = relatedSteps
  }

  const costSoFar = event.metadata?.cost_so_far_usd as number | undefined
  if (costSoFar !== undefined) {
    claudeContext.cost_so_far_usd = costSoFar
  }

  const aiEvent: AIEvent = {
    ...event,
    _claude_context: claudeContext,
  }

  // Compact JSON output (no spaces, one line)
  return JSON.stringify(aiEvent)
}

/**
 * Render multiple ARLS events as JSONL output.
 * Each line is a valid JSON object, suitable for streaming or logging.
 *
 * @param events - Array of ARLS events in order
 * @returns JSONL string (one JSON object per line)
 *
 * @example
 * const events = readJSONLFile('agentlens.log')
 * const jsonl = renderSequenceAI(events)
 * console.log(jsonl)
 */
export function renderSequenceAI(events: ARLSEvent[]): string {
  return events.map((event) => renderEventAI(event)).join('\n')
}
