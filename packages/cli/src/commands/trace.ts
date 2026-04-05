import { createReadStream } from 'fs'
import { createInterface } from 'readline'
import type { ARLSEvent } from '@agentlens/core'

/**
 * Visualize a specific agent run from a JSONL log file.
 * Filters events by run_id and renders them as a tree.
 */
export async function traceCommand(runId: string, filePath: string): Promise<void> {
  try {
    const events = await readJSONLFile(filePath, runId)

    if (events.length === 0) {
      console.log(`No events found for run: ${runId}`)
      return
    }

    // Render the trace
    renderTrace(events)

    // Print summary
    const summary = computeSummary(events)
    printSummary(summary)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(`Failed to trace run: ${message}`)
  }
}

/**
 * Read and parse JSONL file, filtering by run_id
 */
async function readJSONLFile(filePath: string, runId: string): Promise<ARLSEvent[]> {
  const events: ARLSEvent[] = []

  return new Promise((resolve, reject) => {
    const readStream = createReadStream(filePath)
    const rl = createInterface({
      input: readStream,
      crlfDelay: Infinity,
    })

    rl.on('line', (line: string) => {
      if (!line.trim()) return

      try {
        const event = JSON.parse(line)
        if (event.run_id === runId) {
          events.push(event)
        }
      } catch {
        // Skip invalid JSON lines
      }
    })

    rl.on('error', reject)
    rl.on('close', () => resolve(events))
  })
}

/**
 * Render events as a formatted tree
 */
function renderTrace(events: ARLSEvent[]): void {
  if (events.length === 0) return

  const firstEvent = events[0]!

  console.log(`\n${'═'.repeat(60)}`)
  console.log(`🔍 Agent Run Trace: ${firstEvent.run_id}`)
  console.log(`${'═'.repeat(60)}`)
  console.log()

  for (let i = 0; i < events.length; i++) {
    const event = events[i]
    if (!event) continue

    const isLast = i === events.length - 1

    // Render event based on type
    const prefix = isLast ? '└─ ' : '├─ '

    console.log(`${prefix}[${event.step_index}] ${event.schema_type}`)

    if (event.tool) {
      const statusIcon = event.tool.status === 'SUCCESS' ? '✅' : '❌'
      console.log(`   ${' '.repeat(3)}${statusIcon} ${event.tool.name} (${event.tool.duration_ms}ms)`)
    }

    if (event.llm) {
      console.log(`   ${' '.repeat(3)}🧠 ${event.llm.model} (${event.llm.latency_ms}ms)`)
      console.log(`   ${' '.repeat(3)}   tokens: ${event.llm.total_tokens} | cost: $${event.llm.cost_usd.toFixed(4)}`)
    }

    if (event.error) {
      console.log(`   ${' '.repeat(3)}⚠️  ${event.error.code}: ${event.error.message}`)
    }
  }

  console.log()
}

/**
 * Compute summary statistics for the trace
 */
function computeSummary(events: ARLSEvent[]): {
  steps: number
  duration: number
  totalTokens: number
  totalCost: number
  toolCalls: number
  llmCalls: number
  errors: number
} {
  let totalTokens = 0
  let totalCost = 0
  let toolCalls = 0
  let llmCalls = 0
  let errors = 0

  for (const event of events) {
    if (event.tool) toolCalls++
    if (event.llm) {
      llmCalls++
      totalTokens += event.llm.total_tokens
      totalCost += event.llm.cost_usd
    }
    if (event.error) errors++
  }

  const firstEvent = events[0]!
  const lastEvent = events[events.length - 1]!
  const startTime = new Date(firstEvent.timestamp).getTime()
  const endTime = new Date(lastEvent.timestamp).getTime()
  const duration = (endTime - startTime) / 1000

  return {
    steps: events.length,
    duration,
    totalTokens,
    totalCost,
    toolCalls,
    llmCalls,
    errors,
  }
}

/**
 * Print summary statistics
 */
function printSummary(summary: ReturnType<typeof computeSummary>): void {
  console.log(`${'─'.repeat(60)}`)
  console.log(`📊 Summary`)
  console.log(`${'─'.repeat(60)}`)
  console.log(`  Steps:      ${summary.steps}`)
  console.log(`  Duration:   ${summary.duration.toFixed(2)}s`)
  console.log(`  Tool Calls: ${summary.toolCalls}`)
  console.log(`  LLM Calls:  ${summary.llmCalls}`)
  console.log(`  Tokens:     ${summary.totalTokens}`)
  console.log(`  Cost:       $${summary.totalCost.toFixed(4)}`)
  if (summary.errors > 0) {
    console.log(`  Errors:     ${summary.errors} ⚠️`)
  }
  console.log(`${'═'.repeat(60)}\n`)
}
