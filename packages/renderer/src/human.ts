import type { ARLSEvent } from '@agentlens/core'

/**
 * ANSI color codes used for terminal output.
 * Respects NO_COLOR environment variable.
 */
const COLORS = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  gray: '\x1b[90m',
} as const

/** Emoji per agent phase */
const PHASE_EMOJI: Record<string, string> = {
  PLAN: '📋',
  TOOL_CALL: '🔧',
  OBSERVE: '👁',
  REFLECT: '💭',
  RESPOND: '💬',
  IDLE: '⏸',
}

/** Status indicator emojis */
const STATUS_EMOJI: Record<string, string> = {
  SUCCESS: '✅',
  FAILURE: '❌',
  TIMEOUT: '⏰',
  CANCELLED: '⊘',
}

/** Check if we should use colors */
function shouldUseColors(): boolean {
  if (process.env.NO_COLOR) {
    return false
  }
  if (process.env.CI) {
    return false
  }
  return true
}

/** Apply color to text if colors are enabled */
function colorize(text: string, color: string): string {
  if (!shouldUseColors()) {
    return text
  }
  return `${color}${text}${COLORS.reset}`
}

/** Format a timestamp for display */
function formatTime(iso: string): string {
  try {
    const date = new Date(iso)
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      fractionalSecondDigits: 2,
    })
  } catch {
    return iso
  }
}

/** Format milliseconds as a human-readable duration */
function formatDuration(ms: number): string {
  if (ms < 1000) {
    return `${Math.round(ms)}ms`
  }
  return `${(ms / 1000).toFixed(2)}s`
}

/** Format a currency value */
function formatCurrency(usd: number): string {
  return `$${usd.toFixed(4)}`
}

/** Render a TOOL_CALL event */
function renderToolCall(event: ARLSEvent): string[] {
  const lines: string[] = []
  const tool = event.tool
  if (!tool) return lines

  const emoji = PHASE_EMOJI.TOOL_CALL || '🔧'
  const statusEmoji = STATUS_EMOJI[tool.status] || '❓'

  lines.push(
    colorize(`  ${emoji} TOOL CALL`, COLORS.cyan) +
      colorize(`  →  ${tool.name}`, COLORS.dim)
  )

  lines.push(`     input:  ${JSON.stringify(tool.input)}`)

  if (tool.output !== undefined) {
    const outputStr = typeof tool.output === 'string'
      ? tool.output
      : JSON.stringify(tool.output)
    // Truncate long outputs
    if (outputStr.length > 60) {
      lines.push(`     output: ${outputStr.substring(0, 60)}...`)
    } else {
      lines.push(`     output: ${outputStr}`)
    }
  }

  const durationStr = formatDuration(tool.duration_ms)
  lines.push(
    colorize(`     ${statusEmoji} ${tool.status}`, COLORS.green) +
    colorize(`  ${durationStr}`, COLORS.dim)
  )

  if (tool.error_message) {
    lines.push(colorize(`     error: ${tool.error_message}`, COLORS.red))
  }

  return lines
}

/** Render an LLM_CALL event */
function renderLLMCall(event: ARLSEvent): string[] {
  const lines: string[] = []
  const llm = event.llm
  if (!llm) return lines

  lines.push(
    colorize(`  🧠 LLM CALL`, COLORS.blue) +
      colorize(`  →  ${llm.model}`, COLORS.dim)
  )

  const tokenStr = colorize(`${llm.total_tokens}`, COLORS.yellow) +
    colorize(` (${llm.prompt_tokens} in / ${llm.completion_tokens} out)`, COLORS.dim)

  lines.push(`     tokens: ${tokenStr}`)
  lines.push(`     cost:   ${colorize(formatCurrency(llm.cost_usd), COLORS.green)}`)

  const durationStr = formatDuration(llm.latency_ms)

  lines.push(
    colorize(`     ⏱  ${durationStr}`, COLORS.dim) +
      colorize(`  ·  finish: ${llm.finish_reason}`, COLORS.dim)
  )

  return lines
}

/** Render an ERROR event */
function renderError(event: ARLSEvent): string[] {
  const lines: string[] = []
  const error = event.error
  if (!error) return lines

  lines.push(colorize(`  ❌ ERROR`, COLORS.red))
  lines.push(`     code:    ${error.code}`)
  lines.push(`     message: ${error.message}`)

  if (error.recovery_hint) {
    lines.push(`     hint:    ${error.recovery_hint}`)
  }

  return lines
}

/**
 * Render a single ARLS event as human-readable terminal output.
 * Respects NO_COLOR and CI environment variables.
 *
 * @param event - The ARLS event to render
 * @returns Human-readable output as an array of lines
 *
 * @example
 * const event = buildLLMEvent({ ... })
 * const lines = renderEvent(event)
 * console.log(lines.join('\n'))
 */
export function renderEvent(event: ARLSEvent): string[] {
  const lines: string[] = []
  const emoji = PHASE_EMOJI[event.agent.phase] || '❓'

  // Header
  lines.push(
    colorize('[AgentLens]', COLORS.gray) +
    colorize(` ─────────────────────────────────── ${event.run_id}`, COLORS.dim)
  )

  // Event type header
  switch (event.schema_type) {
    case 'AGENT_START':
      lines.push(colorize(`${emoji} AGENT START`, COLORS.cyan) + colorize(`  ${event.agent.name}`, COLORS.dim))
      lines.push(
        colorize(
          `   run_id: ${event.run_id}  ·  trace_id: ${event.trace_id}`,
          COLORS.dim
        )
      )
      break

    case 'AGENT_END':
      lines.push(colorize(`🏁 AGENT END`, COLORS.green) + colorize(`  ${event.run_id}`, COLORS.dim))
      lines.push(
        colorize(
          `   step: ${event.step_index}  ·  timestamp: ${formatTime(event.timestamp)}`,
          COLORS.dim
        )
      )
      break

    case 'TOOL_CALL':
      lines.push(...renderToolCall(event))
      break

    case 'LLM_CALL':
      lines.push(...renderLLMCall(event))
      break

    case 'ERROR':
      lines.push(...renderError(event))
      break

    case 'REASONING_STEP':
      lines.push(colorize(`  ${emoji} REASONING`, COLORS.magenta))
      if (event.metadata?.content) {
        const content = String(event.metadata.content)
        lines.push(`     ${content}`)
      }
      break

    case 'MEMORY_READ':
      lines.push(colorize(`  📖 MEMORY READ`, COLORS.blue))
      if (event.memory?.context_window_used_pct !== undefined) {
        lines.push(`     context: ${event.memory.context_window_used_pct}%`)
      }
      break

    case 'MEMORY_WRITE':
      lines.push(colorize(`  📝 MEMORY WRITE`, COLORS.blue))
      if (event.memory?.context_window_used_pct !== undefined) {
        lines.push(`     context: ${event.memory.context_window_used_pct}%`)
      }
      break

    case 'COST_CHECKPOINT':
      lines.push(colorize(`  💰 COST CHECKPOINT`, COLORS.yellow))
      if (event.metadata?.total_cost_usd) {
        lines.push(`     total: ${formatCurrency(Number(event.metadata.total_cost_usd))}`)
      }
      break

    default:
      lines.push(colorize(`  ❓ ${event.schema_type}`, COLORS.gray))
  }

  // Privacy indicator
  if (event.privacy.pii_detected) {
    lines.push(
      colorize(
        `   [PII REDACTED: ${event.privacy.redacted_fields.join(', ')}]`,
        COLORS.yellow
      )
    )
  }

  // Footer
  lines.push(colorize(`[AgentLens]`, COLORS.gray) + colorize(` ────────────────────────────────────────`, COLORS.dim))

  return lines
}

/**
 * Render multiple ARLS events as a sequence of events.
 * Typically used to render an entire run or trace.
 *
 * @param events - Array of ARLS events in order
 * @returns Formatted output as a single string
 *
 * @example
 * const events = readJSONLFile('agentlens.log')
 * const output = renderSequence(events)
 * console.log(output)
 */
export function renderSequence(events: ARLSEvent[]): string {
  const allLines: string[] = []

  for (const event of events) {
    const lines = renderEvent(event)
    allLines.push(...lines)
  }

  return allLines.join('\n')
}
