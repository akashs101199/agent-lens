import { AsyncLocalStorage } from 'async_hooks'
import { randomUUID } from 'crypto'

/**
 * Represents the current agent run context.
 * Propagates through async call chains without being passed as arguments.
 */
export interface RunContext {
  run_id: string
  trace_id: string
  step_index: number
}

const storage = new AsyncLocalStorage<RunContext>()

/**
 * Generates a random hex string of the specified length.
 */
function randomHex(length: number): string {
  return Array.from({ length }, () => Math.floor(Math.random() * 16).toString(16)).join('')
}

/**
 * Creates a new run context with a unique run_id and trace_id.
 * @param agentName - The name of the agent (used for logging, not in ID generation)
 */
export function createRunContext(agentName: string): RunContext {
  return {
    run_id: `run_${Date.now()}_${randomHex(6)}`,
    trace_id: `trace_${randomHex(12)}`,
    step_index: 0,
  }
}

/**
 * Gets the current run context, or undefined if outside a run.
 */
export function getRunContext(): RunContext | undefined {
  return storage.getStore()
}

/**
 * Runs a function with the given context active.
 * The context is accessible to all async operations within the function.
 */
export async function runInContext<T>(ctx: RunContext, fn: () => Promise<T>): Promise<T> {
  return storage.run(ctx, fn)
}

/**
 * Increments the step_index on the current context.
 * Does nothing if no context is active.
 */
export function incrementStep(): void {
  const ctx = storage.getStore()
  if (ctx) {
    ctx.step_index++
  }
}
