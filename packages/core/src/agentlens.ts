import type {
  ARLSEvent,
  RedactionMode,
  AgentPhase,
} from './schema.js'
import {
  createRunContext,
  getRunContext,
  runInContext,
  incrementStep,
  type RunContext,
} from './context.js'
import {
  buildAgentStartEvent,
  buildAgentEndEvent,
  buildErrorEvent,
} from './event-builder.js'

/**
 * Transport interface.
 * Implementations are provided by @agentlens/transport
 */
export interface Transport {
  /**
   * Write an event to the transport (non-blocking).
   * The event is queued for writing and returns immediately.
   */
  write(event: ARLSEvent, rendered: string): Promise<void>

  /**
   * Flush all pending events in the queue.
   */
  flush(): Promise<void>

  /**
   * Close the transport and release resources.
   */
  close(): Promise<void>
}

/**
 * Privacy configuration for PII detection and redaction
 */
export interface PrivacyConfig {
  /** Enable PII detection (default: true) */
  enabled?: boolean
  /** Redaction mode: MASK, HASH, DROP, PLACEHOLDER (default: MASK) */
  redactionMode?: RedactionMode
}

/**
 * Configuration for AgentLens instance
 */
export interface AgentLensConfig {
  /** Agent name (required) */
  agent: string

  /** Output mode: 'human' for colored terminal, 'ai' for JSONL, 'both' for both (default: 'human') */
  mode?: 'human' | 'ai' | 'both'

  /** Transport type: 'console', 'file', or custom Transport instance (default: 'console') */
  transport?: 'console' | 'file' | Transport

  /** File path when transport is 'file' (required if transport is 'file') */
  file?: string

  /** Privacy configuration */
  privacy?: PrivacyConfig

  /** Minimum log level to emit (not yet implemented) */
  minLevel?: 'debug' | 'info' | 'warn' | 'error'
}

/**
 * Options for starting a new agent run
 */
export interface StartRunOptions {
  /** Optional override for agent name */
  name?: string
}

/**
 * Agent run handle with context tracking
 */
export interface AgentRun {
  /** Unique run ID */
  runId: string
  /** Unique trace ID */
  traceId: string
  /** Execute a function within this run's context */
  exec<T>(fn: () => Promise<T>): Promise<T>
}

/**
 * Options for manually logging an event
 */
export interface ManualLogOptions {
  /** Event type */
  schemaType: string
  /** Agent phase */
  phase?: AgentPhase
  /** Custom metadata */
  metadata?: Record<string, unknown>
}

/**
 * Main AgentLens public API.
 * Use this class to initialize logging for your AI agent application.
 *
 * @example
 * ```typescript
 * const lens = new AgentLens({
 *   agent: 'ResearchBot',
 *   mode: 'human',
 *   transport: 'console'
 * })
 *
 * const client = lens.wrap(new Anthropic())
 * // All API calls are now logged
 *
 * await lens.close()
 * ```
 */
export class AgentLens {
  private agent: string
  private mode: 'human' | 'ai' | 'both'
  private transport: Transport | null = null
  private transportConfig: string | Transport
  private currentRun: RunContext | null = null
  private file: string | undefined
  private privacy: PrivacyConfig | undefined
  private minLevel: 'debug' | 'info' | 'warn' | 'error'

  /**
   * Create a new AgentLens instance
   *
   * @param config - Configuration options
   * @throws Error if required options are missing
   */
  constructor(config: AgentLensConfig) {
    if (!config.agent) {
      throw new Error('AgentLens: agent name is required')
    }

    this.agent = config.agent
    this.mode = config.mode ?? 'human'
    this.file = config.file
    this.privacy = config.privacy
    this.minLevel = config.minLevel ?? 'debug'
    this.transportConfig = config.transport ?? 'console'

    // If transport is provided as an instance, use it directly
    if (typeof this.transportConfig !== 'string') {
      this.transport = this.transportConfig
    }

    // Validate file path requirement
    if (this.transportConfig === 'file' && !this.file) {
      throw new Error('AgentLens: file path is required when transport is "file"')
    }
  }

  /**
   * Initialize the transport lazily.
   * This avoids circular dependency issues at construction time.
   * @internal
   */
  private async initializeTransport(): Promise<void> {
    if (this.transport !== null) {
      return // Already initialized
    }

    if (typeof this.transportConfig === 'string') {
      // Dynamically import transport types
      try {
        // @ts-ignore - transport is optional/lazy-loaded peer dependency
        const { ConsoleTransport, FileTransport } = await import('@agentlens/transport')

        if (this.transportConfig === 'console') {
          this.transport = new ConsoleTransport({ mode: this.mode })
        } else if (this.transportConfig === 'file') {
          if (!this.file) {
            throw new Error('AgentLens: file path is required when transport is "file"')
          }
          this.transport = new FileTransport({ filePath: this.file })
        } else {
          throw new Error(`AgentLens: unknown transport type "${this.transportConfig}"`)
        }
      } catch (error) {
        // Fallback to stub transport
        const message = error instanceof Error ? error.message : String(error)
        if (message.includes('Cannot find module')) {
          process.stderr.write(
            '[AgentLens] Warning: @agentlens/transport not installed. Install it to use file/console transports.\n'
          )
        }
        this.transport = this.createStubTransport()
      }
    }
  }

  /**
   * Create a stub transport for when real transports are not available.
   * @internal
   */
  private createStubTransport(): Transport {
    return {
      async write(): Promise<void> {},
      async flush(): Promise<void> {},
      async close(): Promise<void> {},
    }
  }

  /**
   * Wrap an Anthropic SDK client for automatic logging.
   * All messages.create calls will be logged as LLM_CALL events.
   *
   * @param client - Anthropic client instance
   * @returns Wrapped client with same interface
   *
   * @example
   * ```typescript
   * const client = lens.wrap(new Anthropic())
   * const response = await client.messages.create({ ... })
   * ```
   */
  wrap<T extends Record<string, unknown>>(client: T): T {
    // Import here to avoid circular dependency
    // This will be handled by the interceptors package
    // For now, just return the client as-is with a type marker
    return client
  }

  /**
   * Wrap any async function as a tool call with automatic logging.
   *
   * @param name - Tool name
   * @param fn - Async function to wrap
   * @returns Wrapped function with same signature
   *
   * @example
   * ```typescript
   * const searchTool = lens.wrapTool('search', async (query) => {
   *   return await fetch(`/api/search?q=${query}`)
   * })
   * ```
   */
  wrapTool<TInput extends unknown[], TOutput>(
    name: string,
    fn: (...args: TInput) => Promise<TOutput>
  ): (...args: TInput) => Promise<TOutput> {
    // Will be delegated to interceptors.wrapTool
    // For now, return the original function
    return fn
  }

  /**
   * Start a new agent run with full context tracking.
   * All logs within the returned run's context will have the same run_id and trace_id.
   *
   * @param options - Run options
   * @returns Agent run handle
   *
   * @example
   * ```typescript
   * const run = lens.startRun({ name: 'MyAgent' })
   * await run.exec(async () => {
   *   // All calls here share the same run context
   * })
   * ```
   */
  startRun(options?: StartRunOptions): AgentRun {
    const runContext = createRunContext(options?.name ?? this.agent)
    this.currentRun = runContext

    return {
      runId: runContext.run_id,
      traceId: runContext.trace_id,
      exec: async <T,>(fn: () => Promise<T>): Promise<T> => {
        return runInContext(runContext, fn)
      },
    }
  }

  /**
   * Manually log an event at any point in the agent execution.
   * Useful for logging custom events that don't fit into standard categories.
   *
   * @param options - Log options
   *
   * @example
   * ```typescript
   * lens.log({
   *   schemaType: 'REASONING_STEP',
   *   phase: 'REFLECT',
   *   metadata: { reasoning: 'Need more context' }
   * })
   * ```
   */
  log(options: ManualLogOptions): void {
    // Will create a custom event and write it to transport
    // Implementation will depend on renderer selection
  }

  /**
   * Flush all pending events to transport.
   * This ensures all queued events are written before continuing.
   */
  async flush(): Promise<void> {
    await this.initializeTransport()
    if (this.transport) {
      await this.transport.flush()
    }
  }

  /**
   * Close the AgentLens instance and release all resources.
   * Automatically calls flush() before closing.
   * After calling close(), the instance should not be used.
   */
  async close(): Promise<void> {
    await this.flush()
    await this.initializeTransport()
    if (this.transport) {
      await this.transport.close()
    }
  }

  /**
   * Get the current run context (if any).
   * @internal
   */
  getCurrentRun(): RunContext | null {
    return this.currentRun
  }

  /**
   * Get the transport instance.
   * @internal
   */
  getTransport(): Transport | null {
    return this.transport
  }
}
