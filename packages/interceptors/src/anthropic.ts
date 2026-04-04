import {
  buildLLMEvent,
  getRunContext,
  createRunContext,
  type LLMCallInput,
} from '@agentlens/core'
import { ANTHROPIC_COSTS, calculateCost } from './costs.js'
import { getToolTransport } from './tool.js'

/**
 * Type for Anthropic message creation parameters
 */
interface AnthropicMessageParams {
  model: string
  max_tokens?: number
  messages: Array<{ role: string; content: string }>
  [key: string]: unknown
}

/**
 * Type for Anthropic message response
 */
interface AnthropicMessageResponse {
  model: string
  stop_reason?: string
  usage?: {
    input_tokens?: number
    output_tokens?: number
  }
  [key: string]: unknown
}

/**
 * Type to represent any Anthropic client-like object.
 * We use this to avoid a hard dependency on @anthropic-ai/sdk.
 */
export type AnthropicClient = {
  messages: {
    create: (params: AnthropicMessageParams) => Promise<AnthropicMessageResponse>
  }
}

/**
 * Wraps an Anthropic SDK client to automatically log LLM calls as ARLS events.
 *
 * @param client - An Anthropic client instance
 * @param options - Optional configuration
 * @returns A proxy of the original client with logging enabled
 *
 * @example
 * ```typescript
 * import Anthropic from '@anthropic-ai/sdk'
 * import { wrapAnthropic } from '@agentlens/interceptors'
 *
 * const client = wrapAnthropic(new Anthropic())
 * // All messages.create calls are now automatically logged
 * ```
 */
export function wrapAnthropic(client: AnthropicClient): AnthropicClient {
  const messagesHandler = {
    create: client.messages.create,
  }

  return new Proxy(client, {
    get(target, prop) {
      // Only intercept the messages property
      if (prop === 'messages') {
        return new Proxy(messagesHandler, {
          get(_messagesProxy, messageProp) {
            // Intercept the create method
            if (messageProp === 'create') {
              return async (params: AnthropicMessageParams) => {
                const startTime = Date.now()

                try {
                  // Call the original messages.create
                  const response = (await messagesHandler.create(params)) as AnthropicMessageResponse

                  const endTime = Date.now()
                  const duration = endTime - startTime

                  // Extract token usage
                  const inputTokens = response.usage?.input_tokens ?? 0
                  const outputTokens = response.usage?.output_tokens ?? 0

                  // Extract model name from params
                  const model = params.model ?? 'unknown'

                  // Calculate cost
                  const costUsd = calculateCost(inputTokens, outputTokens, model, ANTHROPIC_COSTS)

                  // Determine finish reason
                  const finishReason = response.stop_reason ?? 'unknown'

                  // Build LLM event
                  const llmInput: LLMCallInput = {
                    model,
                    provider: 'anthropic',
                    prompt_tokens: inputTokens,
                    completion_tokens: outputTokens,
                    cost_usd: costUsd,
                    latency_ms: duration,
                    finish_reason: finishReason,
                  }

                  const ctx = getRunContext() ?? createRunContext('unknown')
                  const event = buildLLMEvent(llmInput, ctx ? undefined : 'unknown', 'RESPOND')

                  // Send to transport if configured
                  const transport = getToolTransport()
                  if (transport?.onEvent) {
                    await transport.onEvent(event)
                  }

                  return response
                } catch (error) {
                  const endTime = Date.now()
                  const duration = endTime - startTime

                  // Build error event
                  const model = params.model ?? 'unknown'
                  const errorMessage =
                    error instanceof Error ? error.message : typeof error === 'string' ? error : 'Unknown error'

                  const llmInput: LLMCallInput = {
                    model,
                    provider: 'anthropic',
                    prompt_tokens: 0,
                    completion_tokens: 0,
                    cost_usd: 0,
                    latency_ms: duration,
                    finish_reason: 'error',
                  }

                  const ctx = getRunContext() ?? createRunContext('unknown')
                  const event = buildLLMEvent(llmInput, ctx ? undefined : 'unknown', 'RESPOND')

                  // Add error metadata
                  if (!event.metadata) {
                    event.metadata = {}
                  }
                  event.metadata.anthropic_error = errorMessage

                  // Send to transport if configured
                  const transport = getToolTransport()
                  if (transport?.onEvent) {
                    await transport.onEvent(event)
                  }

                  // Re-throw the original error
                  throw error
                }
              }
            }

            // Return the original property from messages
            return messagesHandler[messageProp as keyof typeof messagesHandler]
          },
        })
      }

      // Return the original property
      return target[prop as keyof typeof target]
    },
  })
}
