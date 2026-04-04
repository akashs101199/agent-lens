import type { ARLSEvent } from '@agentlens/core'

/**
 * Transport interface that all event transports must implement.
 * Transports are responsible for persisting ARLS events to external systems.
 */
export interface Transport {
  /**
   * Write an event to the transport (non-blocking).
   * The event is queued for writing and returns immediately.
   * To ensure all events are written, call flush() before closing.
   *
   * @param event - The ARLS event to write
   * @param rendered - Pre-rendered event string (human or AI format)
   */
  write(event: ARLSEvent, rendered: string): Promise<void>

  /**
   * Flush all pending events in the queue.
   * Waits until all queued events have been written.
   */
  flush(): Promise<void>

  /**
   * Close the transport and release all resources.
   * Automatically calls flush() before closing.
   */
  close(): Promise<void>
}

/**
 * Configuration for transport queue behavior
 */
export interface TransportQueueConfig {
  /** Maximum number of events in the queue before dropping old events (default: 1000) */
  maxQueueSize?: number
}

/**
 * Base transport class with async queue management.
 * Subclasses should implement the drain() method to write events to their target.
 */
export abstract class BaseTransport implements Transport {
  protected queue: Array<{ event: ARLSEvent; rendered: string }> = []
  protected draining = false
  protected maxQueueSize: number
  protected closed = false

  constructor(config?: TransportQueueConfig) {
    this.maxQueueSize = config?.maxQueueSize ?? 1000
  }

  /**
   * Write an event to the queue (non-blocking).
   * If the queue exceeds maxQueueSize, the oldest event is dropped with a warning.
   */
  async write(event: ARLSEvent, rendered: string): Promise<void> {
    if (this.closed) {
      throw new Error('Cannot write to a closed transport')
    }

    this.queue.push({ event, rendered })

    // Check if queue is oversized
    if (this.queue.length > this.maxQueueSize) {
      const dropped = this.queue.shift()
      if (dropped) {
        const warning = `[AgentLens] Queue overflow: dropped event at run ${dropped.event.run_id} step ${dropped.event.step_index}`
        process.stderr.write(`${warning}\n`)
      }
    }

    // Start draining if not already in progress
    if (!this.draining) {
      this.draining = true
      // Use setImmediate to allow multiple writes to batch before draining
      setImmediate(() => this.drainQueue())
    }
  }

  /**
   * Drain the queue by calling the abstract drain() method.
   * This runs the actual write logic provided by subclasses.
   */
  private async drainQueue(): Promise<void> {
    if (this.queue.length === 0) {
      this.draining = false
      return
    }

    try {
      // Get all items currently in queue
      const batch = this.queue.splice(0, this.queue.length)

      // Write batch through the drain method
      await this.drain(batch)

      // If new items were added during drain, process them
      if (this.queue.length > 0) {
        await this.drainQueue()
      } else {
        this.draining = false
      }
    } catch (error) {
      this.draining = false
      const message = error instanceof Error ? error.message : String(error)
      process.stderr.write(`[AgentLens] Transport drain error: ${message}\n`)
    }
  }

  /**
   * Flush all pending events.
   * Subclasses should override this if they need custom flush behavior.
   */
  async flush(): Promise<void> {
    if (this.closed) {
      return
    }

    // Keep draining until queue is empty
    while (this.queue.length > 0 || this.draining) {
      await new Promise((resolve) => setImmediate(resolve))
    }
  }

  /**
   * Close the transport and release resources.
   * Automatically calls flush() before closing.
   */
  async close(): Promise<void> {
    if (this.closed) {
      return
    }

    await this.flush()
    this.closed = true
    await this.onClose?.()
  }

  /**
   * Abstract method that subclasses must implement.
   * Called to actually write a batch of events to the target.
   *
   * @param batch - Array of events to write
   */
  protected abstract drain(
    batch: Array<{ event: ARLSEvent; rendered: string }>
  ): Promise<void>

  /**
   * Optional lifecycle hook called when close() is invoked.
   * Subclasses can override to clean up resources.
   */
  protected onClose?(): Promise<void>
}
