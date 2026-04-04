import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { AgentLens, type AgentLensConfig, type Transport } from '../src/agentlens.js'

/** Mock transport for testing */
class MockTransport implements Transport {
  public events: Array<{ rendered: string }> = []
  public flushed = false
  public closed = false

  async write(_event: any, rendered: string): Promise<void> {
    this.events.push({ rendered })
  }

  async flush(): Promise<void> {
    this.flushed = true
  }

  async close(): Promise<void> {
    this.closed = true
  }
}

describe('AgentLens', () => {
  let mockTransport: MockTransport

  beforeEach(() => {
    mockTransport = new MockTransport()
  })

  afterEach(async () => {
    if (mockTransport && !mockTransport.closed) {
      await mockTransport.close()
    }
  })

  describe('constructor', () => {
    it('should create instance with required config', async () => {
      const lens = new AgentLens({
        agent: 'TestAgent',
        transport: mockTransport,
      })

      expect(lens).toBeDefined()
      await lens.close()
    })

    it('should throw if agent name is missing', () => {
      expect(() => {
        new AgentLens({
          agent: '',
          transport: mockTransport,
        })
      }).toThrow('agent name is required')
    })

    it('should throw if file transport is used without file path', () => {
      expect(() => {
        new AgentLens({
          agent: 'TestAgent',
          transport: 'file',
        })
      }).toThrow('file path is required')
    })

    it('should accept custom transport instance', async () => {
      const lens = new AgentLens({
        agent: 'TestAgent',
        transport: mockTransport,
      })

      expect(lens.getTransport()).toBe(mockTransport)
      await lens.close()
    })

    it('should use console transport by default', async () => {
      const lens = new AgentLens({
        agent: 'TestAgent',
      })

      expect(lens.getTransport()).toBeDefined()
      await lens.close()
    })

    it('should accept mode and privacy config', async () => {
      const lens = new AgentLens({
        agent: 'TestAgent',
        mode: 'ai',
        privacy: { enabled: true, redactionMode: 'MASK' },
        transport: mockTransport,
      })

      expect(lens).toBeDefined()
      await lens.close()
    })

    it('should set default values for optional config', async () => {
      const lens = new AgentLens({
        agent: 'TestAgent',
        transport: mockTransport,
      })

      expect(lens).toBeDefined()
      await lens.close()
    })
  })

  describe('wrap', () => {
    it('should accept a client object and return it', async () => {
      const lens = new AgentLens({
        agent: 'TestAgent',
        transport: mockTransport,
      })

      const mockClient = { messages: { create: () => {} } }
      const wrapped = lens.wrap(mockClient)

      expect(wrapped).toBe(mockClient)
      await lens.close()
    })

    it('should be callable with Anthropic-like object', async () => {
      const lens = new AgentLens({
        agent: 'TestAgent',
        transport: mockTransport,
      })

      const mockAnthropicClient = {
        messages: {
          create: async () => ({ content: [] }),
        },
      }

      const wrapped = lens.wrap(mockAnthropicClient)
      expect(wrapped).toBeDefined()
      await lens.close()
    })
  })

  describe('wrapTool', () => {
    it('should return a function with same signature', async () => {
      const lens = new AgentLens({
        agent: 'TestAgent',
        transport: mockTransport,
      })

      const originalTool = async (query: string) => `result for ${query}`
      const wrapped = lens.wrapTool('search', originalTool)

      expect(typeof wrapped).toBe('function')
      await lens.close()
    })

    it('should preserve function behavior', async () => {
      const lens = new AgentLens({
        agent: 'TestAgent',
        transport: mockTransport,
      })

      const testTool = async (x: number) => x * 2
      const wrapped = lens.wrapTool('double', testTool)

      const result = await wrapped(5)
      expect(result).toBe(10)
      await lens.close()
    })

    it('should handle async functions', async () => {
      const lens = new AgentLens({
        agent: 'TestAgent',
        transport: mockTransport,
      })

      const asyncTool = async (delay: number) => {
        await new Promise((resolve) => setTimeout(resolve, delay))
        return 'done'
      }

      const wrapped = lens.wrapTool('delay', asyncTool)
      const result = await wrapped(10)

      expect(result).toBe('done')
      await lens.close()
    })

    it('should support multiple argument types', async () => {
      const lens = new AgentLens({
        agent: 'TestAgent',
        transport: mockTransport,
      })

      const multiArgTool = async (a: string, b: number, c: boolean) => `${a}-${b}-${c}`
      const wrapped = lens.wrapTool('multi', multiArgTool)

      const result = await wrapped('test', 42, true)
      expect(result).toBe('test-42-true')
      await lens.close()
    })
  })

  describe('startRun', () => {
    it('should return run handle with runId and traceId', async () => {
      const lens = new AgentLens({
        agent: 'TestAgent',
        transport: mockTransport,
      })

      const run = lens.startRun()

      expect(run.runId).toBeDefined()
      expect(run.traceId).toBeDefined()
      expect(run.runId).toMatch(/^run_/)
      expect(run.traceId).toMatch(/^trace_/)

      await lens.close()
    })

    it('should generate unique run IDs', async () => {
      const lens = new AgentLens({
        agent: 'TestAgent',
        transport: mockTransport,
      })

      const run1 = lens.startRun()
      const run2 = lens.startRun()

      expect(run1.runId).not.toBe(run2.runId)
      expect(run1.traceId).not.toBe(run2.traceId)

      await lens.close()
    })

    it('should execute function within run context', async () => {
      const lens = new AgentLens({
        agent: 'TestAgent',
        transport: mockTransport,
      })

      const run = lens.startRun()
      let executionCount = 0

      const result = await run.exec(async () => {
        executionCount++
        return 'success'
      })

      expect(executionCount).toBe(1)
      expect(result).toBe('success')
      await lens.close()
    })

    it('should accept custom agent name', async () => {
      const lens = new AgentLens({
        agent: 'DefaultAgent',
        transport: mockTransport,
      })

      const run = lens.startRun({ name: 'CustomAgent' })
      expect(run).toBeDefined()
      expect(run.runId).toBeDefined()

      await lens.close()
    })

    it('should handle async operations in run context', async () => {
      const lens = new AgentLens({
        agent: 'TestAgent',
        transport: mockTransport,
      })

      const run = lens.startRun()
      const results: number[] = []

      await run.exec(async () => {
        results.push(1)
        await new Promise((resolve) => setImmediate(resolve))
        results.push(2)
      })

      expect(results).toEqual([1, 2])
      await lens.close()
    })
  })

  describe('log', () => {
    it('should accept manual log options', async () => {
      const lens = new AgentLens({
        agent: 'TestAgent',
        transport: mockTransport,
      })

      expect(() => {
        lens.log({
          schemaType: 'REASONING_STEP',
          phase: 'REFLECT',
          metadata: { content: 'test' },
        })
      }).not.toThrow()

      await lens.close()
    })

    it('should accept minimal log options', async () => {
      const lens = new AgentLens({
        agent: 'TestAgent',
        transport: mockTransport,
      })

      expect(() => {
        lens.log({ schemaType: 'REASONING_STEP' })
      }).not.toThrow()

      await lens.close()
    })
  })

  describe('flush', () => {
    it('should call transport flush', async () => {
      const lens = new AgentLens({
        agent: 'TestAgent',
        transport: mockTransport,
      })

      await lens.flush()

      expect(mockTransport.flushed).toBe(true)
      await lens.close()
    })

    it('should handle multiple flushes', async () => {
      const lens = new AgentLens({
        agent: 'TestAgent',
        transport: mockTransport,
      })

      await lens.flush()
      await lens.flush()

      expect(mockTransport.flushed).toBe(true)
      await lens.close()
    })
  })

  describe('close', () => {
    it('should close the transport', async () => {
      const lens = new AgentLens({
        agent: 'TestAgent',
        transport: mockTransport,
      })

      await lens.close()

      expect(mockTransport.closed).toBe(true)
    })

    it('should flush before closing', async () => {
      const lens = new AgentLens({
        agent: 'TestAgent',
        transport: mockTransport,
      })

      await lens.close()

      expect(mockTransport.flushed).toBe(true)
      expect(mockTransport.closed).toBe(true)
    })

    it('should be idempotent', async () => {
      const lens = new AgentLens({
        agent: 'TestAgent',
        transport: mockTransport,
      })

      await lens.close()
      await lens.close()

      expect(mockTransport.closed).toBe(true)
    })
  })

  describe('lifecycle', () => {
    it('should handle complete init → use → close sequence', async () => {
      const lens = new AgentLens({
        agent: 'TestAgent',
        transport: mockTransport,
      })

      const run = lens.startRun()
      expect(run.runId).toBeDefined()

      const tool = lens.wrapTool('test', async () => 'result')
      const result = await tool()
      expect(result).toBe('result')

      await lens.flush()
      expect(mockTransport.flushed).toBe(true)

      await lens.close()
      expect(mockTransport.closed).toBe(true)
    })

    it('should support multiple runs', async () => {
      const lens = new AgentLens({
        agent: 'TestAgent',
        transport: mockTransport,
      })

      const run1 = lens.startRun()
      const run2 = lens.startRun()
      const run3 = lens.startRun()

      expect(run1.runId).not.toBe(run2.runId)
      expect(run2.runId).not.toBe(run3.runId)

      await lens.close()
    })
  })
})
