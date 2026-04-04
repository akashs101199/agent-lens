import { BaseTransport, type TransportQueueConfig } from './base.js'
import type { ARLSEvent } from '@agentlens/core'

/**
 * Configuration for console transport
 */
export interface ConsoleTransportConfig extends TransportQueueConfig {
  /** Output mode: 'human' for colored terminal, 'ai' for JSONL, 'both' for both */
  mode?: 'human' | 'ai' | 'both'
  /** File path to write AI mode output when using 'both' mode */
  aiOutputFile?: string
}

/**
 * Console transport writes events to process.stdout.
 * Supports human-readable colored output or AI-readable JSONL format.
 *
 * In 'human' mode: outputs colored terminal text
 * In 'ai' mode: outputs compact JSON (one per line)
 * In 'both' mode: outputs human to stdout, AI to optionally specified file or stderr
 */
export class ConsoleTransport extends BaseTransport {
  private mode: 'human' | 'ai' | 'both'
  private aiOutputFile: string | undefined

  constructor(config?: ConsoleTransportConfig) {
    super(config)
    this.mode = config?.mode ?? 'human'
    if (config?.aiOutputFile !== undefined) {
      this.aiOutputFile = config.aiOutputFile
    }
  }

  protected async drain(
    batch: Array<{ event: ARLSEvent; rendered: string }>
  ): Promise<void> {
    for (const item of batch) {
      if (this.mode === 'human' || this.mode === 'both') {
        // Write human-readable output to stdout
        process.stdout.write(`${item.rendered}\n`)
      }

      if (this.mode === 'ai' || this.mode === 'both') {
        // In 'both' mode, write AI output to specified file or stderr
        // In 'ai' mode, the rendered string should already be JSON
        const output = `${item.rendered}\n`

        if (this.mode === 'both' && this.aiOutputFile) {
          // When using file output, we'll handle this in a subclass
          // For now, write to stderr as fallback
          process.stderr.write(output)
        } else if (this.mode === 'ai') {
          // Direct AI mode: write to stdout
          process.stdout.write(output)
        }
      }
    }
  }
}
