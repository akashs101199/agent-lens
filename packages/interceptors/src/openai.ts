import {
  buildLLMEvent,
  getRunContext,
  createRunContext,
  type LLMCallInput,
} from '@agentlens/core'
import { OPENAI_COSTS, calculateCost } from './costs.js'
import { getToolTransport } from './tool.js'

/**
 * Type for OpenAI chat completion parameters
 */
interface OpenAIChatCompletionParams {
  model: string
  messages: Array<{ role: string; content: string }>
  max_tokens?: number
  [key: string]: unknown
}

/**
 * Type for OpenAI chat completion response
 */
interface OpenAIChatCompletionResponse {
  model: string
  finish_reason?: string
  usage?: {
    prompt_tokens?: number
    completion_tokens?: number
  }
  [key: string]: unknown
}

/**
 * Type to represent any OpenAI client-like object.
 * We use this to avoid a hard dependency on the openai SDK.
 */
export type OpenAIClient = {
  chat: {
    completions: {
      create: (params: OpenAIChatCompletionParams) => Promise<OpenAIChatCompletionResponse>
    }
  }
}

/**
 * Wraps an OpenAI SDK client to automatically log LLM calls as ARLS events.
 *
 * @param client - An OpenAI client instance
 * @param options - Optional configuration
 * @returns A proxy of the original client with logging enabled
 *
 * @example
 * ```typescript
 * import OpenAI from 'openai'
 * import { wrapOpenAI } from '@agentlens/interceptors'
 *
 * const client = wrapOpenAI(new OpenAI())
 * // All chat.completions.create calls are now automatically logged
 * ```
 */
export function wrapOpenAI(client: OpenAIClient): OpenAIClient {
  const completionsHandler = {
    create: client.chat.completions.create,
  }

  return new Proxy(client, {
    get(target, prop) {
      // Only intercept the chat property
      if (prop === 'chat') {
        return new Proxy(target.chat, {
          get(_chatProxy, chatProp) {
            // Intercept the completions property
            if (chatProp === 'completions') {
              return new Proxy(completionsHandler, {
                get(_completionsProxy, completionsProp) {
                  // Intercept the create method
                  if (completionsProp === 'create') {
                    return async (params: OpenAIChatCompletionParams) => {
                      const startTime = Date.now()

                      try {
                        // Call the original chat.completions.create
                        const response = (await completionsHandler.create(
                          params,
                        )) as OpenAIChatCompletionResponse

                        const endTime = Date.now()
                        const duration = endTime - startTime

                        // Extract token usage
                        const inputTokens = response.usage?.prompt_tokens ?? 0
                        const outputTokens = response.usage?.completion_tokens ?? 0

                        // Extract model name from params
                        const model = params.model ?? 'unknown'

                        // Calculate cost
                        const costUsd = calculateCost(inputTokens, outputTokens, model, OPENAI_COSTS)

                        // Determine finish reason
                        const finishReason = response.finish_reason ?? 'unknown'

                        // Build LLM event
                        const llmInput: LLMCallInput = {
                          model,
                          provider: 'openai',
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
                          error instanceof Error
                            ? error.message
                            : typeof error === 'string'
                              ? error
                              : 'Unknown error'

                        const llmInput: LLMCallInput = {
                          model,
                          provider: 'openai',
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
                        event.metadata.openai_error = errorMessage

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

                  // Return the original property from completions
                  return completionsHandler[completionsProp as keyof typeof completionsHandler]
                },
              })
            }

            // Return the original property from chat
            return target.chat[chatProp as keyof typeof target.chat]
          },
        })
      }

      // Return the original property
      return target[prop as keyof typeof target]
    },
  })
}
