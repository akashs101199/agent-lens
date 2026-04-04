/**
 * Cost table for LLM API calls (per 1M tokens, USD).
 * Used by SDK interceptors to estimate costs.
 */

export interface ModelCostTable {
  input: number
  output: number
}

export const ANTHROPIC_COSTS: Record<string, ModelCostTable> = {
  'claude-opus-4-1': { input: 15.0, output: 75.0 },
  'claude-opus-4': { input: 15.0, output: 75.0 },
  'claude-sonnet-4-20250514': { input: 3.0, output: 15.0 },
  'claude-sonnet-4': { input: 3.0, output: 15.0 },
  'claude-haiku-4-20250514': { input: 0.8, output: 4.0 },
  'claude-haiku-4': { input: 0.8, output: 4.0 },
  'claude-haiku-3-5': { input: 0.8, output: 4.0 },
  'claude-3-5-sonnet': { input: 3.0, output: 15.0 },
  'claude-3-opus': { input: 15.0, output: 75.0 },
  'claude-3-sonnet': { input: 3.0, output: 15.0 },
  'claude-3-haiku': { input: 0.25, output: 1.25 },
}

export const OPENAI_COSTS: Record<string, ModelCostTable> = {
  'gpt-4o': { input: 2.5, output: 10.0 },
  'gpt-4o-mini': { input: 0.15, output: 0.6 },
  'gpt-4-turbo': { input: 10.0, output: 30.0 },
  'gpt-4': { input: 30.0, output: 60.0 },
  'o1': { input: 15.0, output: 60.0 },
  'o1-mini': { input: 3.0, output: 12.0 },
}

/**
 * Calculates the cost in USD for an LLM call.
 * @param tokens - Total tokens used
 * @param model - Model identifier
 * @param costs - Cost table to use
 * @returns Cost in USD
 */
export function calculateCost(
  inputTokens: number,
  outputTokens: number,
  model: string,
  costs: Record<string, ModelCostTable>,
): number {
  const cost = costs[model]
  if (!cost) {
    // Fallback: return 0 if model not found
    return 0
  }

  const inputCost = (inputTokens / 1_000_000) * cost.input
  const outputCost = (outputTokens / 1_000_000) * cost.output
  return inputCost + outputCost
}
