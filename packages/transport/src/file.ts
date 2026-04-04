import { BaseTransport, type TransportQueueConfig } from './base.js'
import type { ARLSEvent } from '@agentlens/core'
import { promises as fs } from 'fs'
import { dirname, join } from 'path'

/**
 * Configuration for file transport
 */
export interface FileTransportConfig extends TransportQueueConfig {
  /** Path to write log file (required) */
  filePath: string
  /** Maximum file size in bytes before rotation (default: 50MB) */
  maxFileSize?: number
  /** Maximum number of rotated files to keep (default: 5) */
  maxRotatedFiles?: number
}

/**
 * File transport writes ARLS events to a JSONL file with rotation support.
 * Events are written one JSON object per line (JSONL format).
 * When file exceeds maxFileSize, it rotates: file.log → file.1.log, etc.
 *
 * @example
 * const transport = new FileTransport({
 *   filePath: './logs/agentlens.log',
 *   maxFileSize: 50 * 1024 * 1024, // 50MB
 *   maxRotatedFiles: 5,
 * })
 */
export class FileTransport extends BaseTransport {
  private filePath: string
  private maxFileSize: number
  private maxRotatedFiles: number
  private currentFileSize = 0

  constructor(config: FileTransportConfig) {
    super(config)
    this.filePath = config.filePath
    this.maxFileSize = config.maxFileSize ?? 50 * 1024 * 1024 // 50MB default
    this.maxRotatedFiles = config.maxRotatedFiles ?? 5
  }

  protected async drain(
    batch: Array<{ event: ARLSEvent; rendered: string }>
  ): Promise<void> {
    // Ensure directory exists
    const dir = dirname(this.filePath)
    try {
      await fs.mkdir(dir, { recursive: true })
    } catch {
      // Directory might already exist or creation might fail temporarily
    }

    for (const item of batch) {
      // Write one JSON line per event
      const line = `${item.rendered}\n`

      // Check if rotation is needed
      if (this.currentFileSize + line.length > this.maxFileSize) {
        await this.rotate()
        this.currentFileSize = 0
      }

      // Append to file
      try {
        await fs.appendFile(this.filePath, line, 'utf-8')
        this.currentFileSize += line.length
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        process.stderr.write(`[AgentLens] File write error: ${message}\n`)
      }
    }
  }

  /**
   * Rotate the log file when it exceeds maxFileSize.
   * Old files are renamed: agentlens.log → agentlens.1.log → agentlens.2.log, etc.
   */
  private async rotate(): Promise<void> {
    try {
      // Get the base name and extension
      const lastDot = this.filePath.lastIndexOf('.')
      const basePath = lastDot > 0 ? this.filePath.substring(0, lastDot) : this.filePath
      const ext = lastDot > 0 ? this.filePath.substring(lastDot) : ''

      // Rename existing rotated files in reverse order
      for (let i = this.maxRotatedFiles - 1; i >= 1; i--) {
        const oldPath = `${basePath}.${i}${ext}`
        const newPath = `${basePath}.${i + 1}${ext}`

        try {
          await fs.rename(oldPath, newPath)
        } catch {
          // File might not exist, that's okay
        }
      }

      // Rename current file to .1
      const newPath = `${basePath}.1${ext}`
      try {
        await fs.rename(this.filePath, newPath)
      } catch {
        // File might not exist yet
      }

      // Clean up oldest file if needed
      const oldestPath = `${basePath}.${this.maxRotatedFiles + 1}${ext}`
      try {
        await fs.unlink(oldestPath)
      } catch {
        // File doesn't exist, that's fine
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      process.stderr.write(`[AgentLens] File rotation error: ${message}\n`)
    }
  }

  /**
   * Get the current file size to support testing.
   * @internal
   */
  async _getCurrentFileSize(): Promise<number> {
    try {
      const stats = await fs.stat(this.filePath)
      return stats.size
    } catch {
      return 0
    }
  }
}
