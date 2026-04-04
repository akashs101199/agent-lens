import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { BaseTransport, type Transport } from '../src/base.js'
import type { ARLSEvent, AgentContext } from '@agentlens/core'

/** Test implementation of BaseTransport */
class TestTransport extends BaseTransport {
  public drained: Array<{ event: ARLSEvent; rendered: string }> = []

  protected async drain(batch: Array<{ event: ARLSEvent; rendered: string }>): Promise<void> {
    this.drained.push(...batch)
  }
}

/** Create a minimal valid ARLS event for testing */
function createTestEvent(overrides?: Partial<ARLSEvent>): ARLSEvent {
  const baseAgent: AgentContext = {
    name: 'TestAgent',
    phase: 'PLAN',
  }

  const baseEvent: ARLSEvent = {
    agentlens_version: '1.0',
    schema_type: 'REASONING_STEP',
    timestamp: new Date().toISOString(),
    trace_id: 'trace_abc123',
    run_id: 'run_123',
    step_index: 1,
    agent: baseAgent,
    privacy: {
      pii_detected: false,
      redacted_fields: [],
    },
    semantic_tags: [],
    ...overrides,
  }

  return baseEvent
}

describe('BaseTransport', () => {
  let transport: TestTransport

  beforeEach(() => {
    transport = new TestTransport()
  })

  afterEach(async () => {
    await transport.close()
  })

  describe('write', () => {
    it('should queue events without blocking', async () => {
      const event = createTestEvent()
      const rendered = 'test output'

      const startTime = Date.now()
      await transport.write(event, rendered)
      const elapsed = Date.now() - startTime

      // Write should return quickly (less than 100ms)
      expect(elapsed).toBeLessThan(100)
    })

    it('should drain events to the target', async () => {
      const event1 = createTestEvent({ step_index: 1 })
      const event2 = createTestEvent({ step_index: 2 })

      await transport.write(event1, 'output1')
      await transport.write(event2, 'output2')
      await transport.flush()

      expect(transport.drained).toHaveLength(2)
      expect(transport.drained[0].event.step_index).toBe(1)
      expect(transport.drained[1].event.step_index).toBe(2)
    })

    it('should throw error if writing to a closed transport', async () => {
      const event = createTestEvent()
      await transport.close()

      await expect(transport.write(event, 'output')).rejects.toThrow(
        'Cannot write to a closed transport'
      )
    })

    it('should batch events for efficiency', async () => {
      const event1 = createTestEvent({ step_index: 1 })
      const event2 = createTestEvent({ step_index: 2 })
      const event3 = createTestEvent({ step_index: 3 })

      // Write multiple events in quick succession
      await transport.write(event1, 'output1')
      await transport.write(event2, 'output2')
      await transport.write(event3, 'output3')
      await transport.flush()

      // Should be drained in batch
      expect(transport.drained).toHaveLength(3)
    })
  })

  describe('queue management', () => {
    it('should respect max queue size', async () => {
      const smallTransport = new TestTransport({ maxQueueSize: 3 })
      const captured: string[] = []

      // Capture stderr
      const originalStderr = process.stderr.write
      process.stderr.write = ((text: string) => {
        captured.push(text)
        return true
      }) as any

      try {
        const events = Array.from({ length: 5 }, (_, i) =>
          createTestEvent({ step_index: i + 1 })
        )

        for (const event of events) {
          await smallTransport.write(event, `output${event.step_index}`)
        }

        await smallTransport.flush()

        // Should have dropped 2 events (queue overflow)
        expect(captured.some((msg) => msg.includes('Queue overflow'))).toBe(true)
        expect(smallTransport.drained.length).toBeLessThan(5)
      } finally {
        process.stderr.write = originalStderr
        await smallTransport.close()
      }
    })

    it('should handle default queue size', async () => {
      const transport2 = new TestTransport()
      expect(transport2).toBeDefined()
      await transport2.close()
    })
  })

  describe('flush', () => {
    it('should wait for all events to be written', async () => {
      const events = Array.from({ length: 10 }, (_, i) =>
        createTestEvent({ step_index: i + 1 })
      )

      for (const event of events) {
        await transport.write(event, `output${event.step_index}`)
      }

      await transport.flush()

      expect(transport.drained).toHaveLength(10)
    })

    it('should be idempotent', async () => {
      const event = createTestEvent()
      await transport.write(event, 'output')

      await transport.flush()
      const count1 = transport.drained.length

      await transport.flush()
      const count2 = transport.drained.length

      expect(count1).toBe(count2)
    })

    it('should resolve when queue is empty', async () => {
      const event = createTestEvent()
      await transport.write(event, 'output')

      const startTime = Date.now()
      await transport.flush()
      const elapsed = Date.now() - startTime

      expect(transport.drained).toHaveLength(1)
      // Flush should complete reasonably quickly
      expect(elapsed).toBeLessThan(500)
    })
  })

  describe('close', () => {
    it('should flush before closing', async () => {
      const event = createTestEvent()
      await transport.write(event, 'output')

      await transport.close()

      expect(transport.drained).toHaveLength(1)
    })

    it('should be idempotent', async () => {
      const event = createTestEvent()
      await transport.write(event, 'output')

      await transport.close()
      await transport.close()

      expect(transport.drained).toHaveLength(1)
    })

    it('should prevent further writes', async () => {
      await transport.close()

      const event = createTestEvent()
      await expect(transport.write(event, 'output')).rejects.toThrow()
    })
  })

  describe('lifecycle', () => {
    it('should handle write → flush → close sequence', async () => {
      const events = Array.from({ length: 5 }, (_, i) =>
        createTestEvent({ step_index: i + 1 })
      )

      for (const event of events) {
        await transport.write(event, `output${event.step_index}`)
      }

      await transport.flush()
      expect(transport.drained).toHaveLength(5)

      await transport.close()
      expect(transport.drained).toHaveLength(5)
    })

    it('should handle close without write', async () => {
      await expect(transport.close()).resolves.toBeUndefined()
    })
  })
})
