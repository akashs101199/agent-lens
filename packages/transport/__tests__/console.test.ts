import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { ConsoleTransport } from '../src/console.js'
import type { ARLSEvent, AgentContext } from '@agentlens/core'

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

describe('ConsoleTransport', () => {
  let stdoutSpy: any
  let stderrSpy: any

  beforeEach(() => {
    stdoutSpy = vi.spyOn(process.stdout, 'write').mockReturnValue(true)
    stderrSpy = vi.spyOn(process.stderr, 'write').mockReturnValue(true)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('human mode', () => {
    it('should write to stdout in human mode', async () => {
      const transport = new ConsoleTransport({ mode: 'human' })
      const event = createTestEvent()
      const rendered = '[AgentLens] Test output'

      await transport.write(event, rendered)
      await transport.flush()

      expect(stdoutSpy).toHaveBeenCalledWith(expect.stringContaining('[AgentLens]'))
      expect(stdoutSpy).toHaveBeenCalledWith(expect.stringContaining('\n'))

      await transport.close()
    })

    it('should be default mode', async () => {
      const transport = new ConsoleTransport()
      const event = createTestEvent()

      await transport.write(event, 'test output')
      await transport.flush()

      expect(stdoutSpy).toHaveBeenCalled()

      await transport.close()
    })
  })

  describe('ai mode', () => {
    it('should write to stdout in ai mode', async () => {
      const transport = new ConsoleTransport({ mode: 'ai' })
      const event = createTestEvent()
      const rendered = JSON.stringify(event)

      await transport.write(event, rendered)
      await transport.flush()

      expect(stdoutSpy).toHaveBeenCalledWith(expect.stringContaining('agentlens_version'))
      expect(stdoutSpy).toHaveBeenCalledWith(expect.stringContaining('\n'))

      await transport.close()
    })
  })

  describe('both mode', () => {
    it('should write human to stdout in both mode', async () => {
      const transport = new ConsoleTransport({ mode: 'both' })
      const event = createTestEvent()
      const rendered = '[AgentLens] Test'

      await transport.write(event, rendered)
      await transport.flush()

      expect(stdoutSpy).toHaveBeenCalledWith(expect.stringContaining('[AgentLens]'))

      await transport.close()
    })

    it('should handle multiple events', async () => {
      const transport = new ConsoleTransport({ mode: 'human' })
      const event1 = createTestEvent({ step_index: 1 })
      const event2 = createTestEvent({ step_index: 2 })

      await transport.write(event1, 'event 1')
      await transport.write(event2, 'event 2')
      await transport.flush()

      // Should have been called with output
      expect(stdoutSpy.mock.calls.length).toBeGreaterThan(0)

      await transport.close()
    })
  })

  describe('batching', () => {
    it('should batch writes efficiently', async () => {
      const transport = new ConsoleTransport({ mode: 'human' })
      const events = Array.from({ length: 5 }, (_, i) =>
        createTestEvent({ step_index: i + 1 })
      )

      for (const event of events) {
        await transport.write(event, `event ${event.step_index}`)
      }

      await transport.flush()

      // Multiple writes should be batched
      expect(stdoutSpy).toHaveBeenCalled()

      await transport.close()
    })
  })

  describe('lifecycle', () => {
    it('should handle write, flush, close sequence', async () => {
      const transport = new ConsoleTransport({ mode: 'human' })
      const event = createTestEvent()

      await transport.write(event, 'test')
      await transport.flush()
      await transport.close()

      expect(stdoutSpy).toHaveBeenCalled()
    })

    it('should handle close without write', async () => {
      const transport = new ConsoleTransport()
      await expect(transport.close()).resolves.toBeUndefined()
    })
  })
})
