import { createReadStream } from 'fs'
import { createInterface } from 'readline'
import type { ARLSEvent } from '@agentlens/core'

interface AnalysisResult {
  totalRuns: number
  totalLLMCalls: number
  totalToolCalls: number
  totalTokens: number
  totalCost: number
  averageCostPerRun: number
  slowestTool: { name: string; duration: number } | null
  mostExpensiveRun: { runId: string; cost: number } | null
  mostCommonError: { code: string; count: number } | null
}

/**
 * Analyze agent behavior from a JSONL log file.
 * Computes statistics and identifies patterns.
 */
export async function analyzeCommand(filePath: string): Promise<void> {
  try {
    const events = await readJSONLFile(filePath)

    if (events.length === 0) {
      console.log('No events found in log file.')
      return
    }

    const analysis = analyzeEvents(events)
    printAnalysis(analysis)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(`Failed to analyze log file: ${message}`)
  }
}

/**
 * Read and parse JSONL file
 */
async function readJSONLFile(filePath: string): Promise<ARLSEvent[]> {
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
        events.push(event)
      } catch {
        // Skip invalid JSON lines
      }
    })

    rl.on('error', reject)
    rl.on('close', () => resolve(events))
  })
}

/**
 * Analyze events and compute statistics
 */
function analyzeEvents(events: ARLSEvent[]): AnalysisResult {
  const runs = new Set<string>()
  let totalLLMCalls = 0
  let totalToolCalls = 0
  let totalTokens = 0
  let totalCost = 0

  const runCosts: Record<string, number> = {}
  const toolDurations: Array<{ name: string; duration: number }> = []
  const errorCodes: Record<string, number> = {}

  for (const event of events) {
    runs.add(event.run_id)

    if (event.llm) {
      totalLLMCalls++
      totalTokens += event.llm.total_tokens
      totalCost += event.llm.cost_usd
      runCosts[event.run_id] = (runCosts[event.run_id] ?? 0) + event.llm.cost_usd
    }

    if (event.tool) {
      totalToolCalls++
      toolDurations.push({
        name: event.tool.name,
        duration: event.tool.duration_ms,
      })
    }

    if (event.error) {
      errorCodes[event.error.code] = (errorCodes[event.error.code] ?? 0) + 1
    }
  }

  // Find slowest tool
  let slowestTool: { name: string; duration: number } | null = null
  if (toolDurations.length > 0) {
    slowestTool = toolDurations.reduce((max, current) =>
      current.duration > max.duration ? current : max
    )
  }

  // Find most expensive run
  let mostExpensiveRun: { runId: string; cost: number } | null = null
  for (const [runId, cost] of Object.entries(runCosts)) {
    if (!mostExpensiveRun || cost > mostExpensiveRun.cost) {
      mostExpensiveRun = { runId, cost }
    }
  }

  // Find most common error
  let mostCommonError: { code: string; count: number } | null = null
  for (const [code, count] of Object.entries(errorCodes)) {
    if (!mostCommonError || count > mostCommonError.count) {
      mostCommonError = { code, count }
    }
  }

  return {
    totalRuns: runs.size,
    totalLLMCalls,
    totalToolCalls,
    totalTokens,
    totalCost,
    averageCostPerRun: totalCost / runs.size,
    slowestTool,
    mostExpensiveRun,
    mostCommonError,
  }
}

/**
 * Print analysis results
 */
function printAnalysis(result: AnalysisResult): void {
  console.log(`\n${'═'.repeat(60)}`)
  console.log(`📈 Agent Behavior Analysis`)
  console.log(`${'═'.repeat(60)}\n`)

  // Summary statistics
  console.log(`📊 Overall Statistics`)
  console.log(`${'─'.repeat(60)}`)
  console.log(`  Total Runs:       ${result.totalRuns}`)
  console.log(`  LLM Calls:        ${result.totalLLMCalls}`)
  console.log(`  Tool Calls:       ${result.totalToolCalls}`)
  console.log(`  Total Tokens:     ${result.totalTokens}`)
  console.log(`  Total Cost:       $${result.totalCost.toFixed(4)}`)
  console.log(`  Avg Cost/Run:     $${result.averageCostPerRun.toFixed(4)}`)
  console.log()

  // Performance insights
  console.log(`⚡ Performance Insights`)
  console.log(`${'─'.repeat(60)}`)

  if (result.slowestTool) {
    console.log(`  Slowest Tool:     ${result.slowestTool.name} (${result.slowestTool.duration}ms)`)
  } else {
    console.log(`  Slowest Tool:     No tool calls recorded`)
  }

  if (result.mostExpensiveRun) {
    console.log(`  Most Expensive:   ${result.mostExpensiveRun.runId} ($${result.mostExpensiveRun.cost.toFixed(4)})`)
  } else {
    console.log(`  Most Expensive:   No runs with costs`)
  }

  if (result.mostCommonError) {
    console.log(`  Most Common Error: ${result.mostCommonError.code} (${result.mostCommonError.count}x)`)
  } else {
    console.log(`  Most Common Error: No errors recorded`)
  }

  console.log()
  console.log(`${'═'.repeat(60)}\n`)
}
