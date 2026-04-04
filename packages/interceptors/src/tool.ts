import {
  buildToolEvent,
  getRunContext,
  createRunContext,
  type ToolCallInput,
  type ARLSEvent,
} from '@agentlens/core'

/**
 * Options for wrapping a tool with AgentLens tracing.
 */
export interface WrapToolOptions {
  /** Additional semantic tags to add to the event */
  semanticTags?: string[]
  /** Additional metadata to include in the event */
  metadata?: Record<string, unknown>
}

/**
 * Configuration for the tool transport where events are sent.
 */
export interface ToolTransportConfig {
  /** Called when a tool event is generated */
  onEvent?: (event: ARLSEvent) => Promise<void> | void
}

let toolTransport: ToolTransportConfig | undefined

/**
 * Sets the transport handler for tool events.
 * @param config - Transport configuration
 */
export function setToolTransport(config: ToolTransportConfig): void {
  toolTransport = config
}

/**
 * Gets the current tool transport configuration.
 * @internal
 */
export function getToolTransport(): ToolTransportConfig | undefined {
  return toolTransport
}

/**
 * Wraps any async function as an AgentLens-traced tool.
 * Automatically captures input, output, duration, and status.
 *
 * @param name - The name of the tool for logging
 * @param fn - The async function to wrap
 * @param options - Optional configuration for semantic tags and metadata
 * @returns A wrapped function with identical signature and behavior
 *
 * @example
 * ```typescript
 * const search = wrapTool('web_search', async (query: string) => {
 *   return await fetch(`https://api.example.com/search?q=${query}`);
 * });
 *
 * const results = await search('AI agents');
 * // Automatically logs a TOOL_CALL event with metrics
 * ```
 */
export function wrapTool<TInput extends unknown[], TOutput>(
  name: string,
  fn: (...args: TInput) => Promise<TOutput>,
  options?: WrapToolOptions,
): (...args: TInput) => Promise<TOutput> {
  return async (...args: TInput): Promise<TOutput> => {
    const startTime = Date.now()

    try {
      // Call the original function
      const output = await fn(...args)
      const endTime = Date.now()
      const duration = endTime - startTime

      // Build tool event on success
      const toolInput: Record<string, unknown> = {}
      // For now, store args as indexed properties
      args.forEach((arg, index) => {
        toolInput[`arg${index}`] = arg
      })

      const toolCallInput: ToolCallInput = {
        name,
        input: toolInput,
        output,
        status: 'SUCCESS',
        duration_ms: duration,
      }

      const ctx = getRunContext() ?? createRunContext('unknown')
      const event = buildToolEvent(toolCallInput, ctx ? undefined : 'unknown', 'TOOL_CALL')

      // Add semantic tags if provided
      if (options?.semanticTags) {
        event.semantic_tags.push(...options.semanticTags)
      }

      // Add metadata if provided
      if (options?.metadata) {
        event.metadata = { ...event.metadata, ...options.metadata }
      }

      // Send to transport if configured
      if (toolTransport?.onEvent) {
        await toolTransport.onEvent(event)
      }

      return output
    } catch (error) {
      const endTime = Date.now()
      const duration = endTime - startTime

      // Build tool event on failure
      const toolInput: Record<string, unknown> = {}
      args.forEach((arg, index) => {
        toolInput[`arg${index}`] = arg
      })

      let errorMessage: string | undefined
      if (error instanceof Error) {
        errorMessage = error.message
      } else if (typeof error === 'string') {
        errorMessage = error
      }

      const toolCallInput: ToolCallInput = {
        name,
        input: toolInput,
        output: null,
        status: 'FAILURE',
        duration_ms: duration,
      }

      if (errorMessage !== undefined) {
        toolCallInput.error_message = errorMessage
      }

      const ctx = getRunContext() ?? createRunContext('unknown')
      const event = buildToolEvent(toolCallInput, ctx ? undefined : 'unknown', 'TOOL_CALL')

      // Add semantic tags if provided
      if (options?.semanticTags) {
        event.semantic_tags.push(...options.semanticTags)
      }

      // Add metadata if provided
      if (options?.metadata) {
        event.metadata = { ...event.metadata, ...options.metadata }
      }

      // Send to transport if configured
      if (toolTransport?.onEvent) {
        await toolTransport.onEvent(event)
      }

      // Re-throw the original error — AgentLens must be transparent
      throw error
    }
  }
}
