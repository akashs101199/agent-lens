import { describe, it, expect, beforeEach, vi } from 'vitest'
import { wrapTool, setToolTransport, type ToolTransportConfig } from '../src/tool.js'
import { runInContext, createRunContext } from '@agentlens/core'

describe('Tool Interceptor', () => {
  let capturedEvents: any[] = []
  let transport: ToolTransportConfig

  beforeEach(() => {
    capturedEvents = []
    transport = {
      onEvent: async (event) => {
        capturedEvents.push(event)
      },
    }
    setToolTransport(transport)
  })

  it('should wrap a simple async function', async () => {
    const add = wrapTool('add', async (a: number, b: number) => {
      return a + b
    })

    const result = await add(2, 3)

    expect(result).toBe(5)
    expect(capturedEvents).toHaveLength(1)
    expect(capturedEvents[0].schema_type).toBe('TOOL_CALL')
    expect(capturedEvents[0].tool?.name).toBe('add')
    expect(capturedEvents[0].tool?.status).toBe('SUCCESS')
  })

  it('should preserve return value exactly', async () => {
    const returnObject = { data: 'test', nested: { value: 42 } }
    const fn = wrapTool('getObject', async () => {
      return returnObject
    })

    const result = await fn()

    expect(result).toBe(returnObject)
    expect(result.nested.value).toBe(42)
  })

  it('should capture tool input parameters', async () => {
    const fn = wrapTool('search', async (query: string, limit: number) => {
      return { query, limit }
    })

    await fn('test', 10)

    expect(capturedEvents[0].tool?.input).toEqual({
      arg0: 'test',
      arg1: 10,
    })
  })

  it('should capture tool output', async () => {
    const fn = wrapTool('process', async (data: string) => {
      return { processed: data.toUpperCase() }
    })

    await fn('hello')

    expect(capturedEvents[0].tool?.output).toEqual({ processed: 'HELLO' })
  })

  it('should measure execution duration', async () => {
    const fn = wrapTool('slow', async () => {
      await new Promise((resolve) => setTimeout(resolve, 50))
      return 'done'
    })

    await fn()

    const duration = capturedEvents[0].tool?.duration_ms
    // Allow some timing variance (40ms to 150ms for a 50ms operation)
    expect(duration).toBeGreaterThanOrEqual(40)
    expect(duration).toBeLessThan(150)
  })

  it('should re-throw errors unchanged', async () => {
    const customError = new Error('Custom error message')
    const fn = wrapTool('failing', async () => {
      throw customError
    })

    await expect(fn()).rejects.toThrow('Custom error message')
  })

  it('should log failures with error message', async () => {
    const fn = wrapTool('fails', async () => {
      throw new Error('Tool failed')
    })

    try {
      await fn()
    } catch {
      // Error expected
    }

    expect(capturedEvents[0].tool?.status).toBe('FAILURE')
    expect(capturedEvents[0].tool?.error_message).toBe('Tool failed')
  })

  it('should handle string errors', async () => {
    const fn = wrapTool('stringError', async () => {
      throw 'String error'
    })

    try {
      await fn()
    } catch {
      // Error expected
    }

    expect(capturedEvents[0].tool?.status).toBe('FAILURE')
    expect(capturedEvents[0].tool?.error_message).toBe('String error')
  })

  it('should set output to null on failure', async () => {
    const fn = wrapTool('fails', async () => {
      throw new Error('Failed')
    })

    try {
      await fn()
    } catch {
      // Error expected
    }

    expect(capturedEvents[0].tool?.output).toBeNull()
  })

  it('should support semantic tags option', async () => {
    const fn = wrapTool('tagged', async () => 'result', {
      semanticTags: ['external-api', 'search'],
    })

    await fn()

    expect(capturedEvents[0].semantic_tags).toContain('external-api')
    expect(capturedEvents[0].semantic_tags).toContain('search')
  })

  it('should support metadata option', async () => {
    const fn = wrapTool('withMetadata', async () => 'result', {
      metadata: { provider: 'openai', model: 'gpt-4' },
    })

    await fn()

    expect(capturedEvents[0].metadata).toMatchObject({
      provider: 'openai',
      model: 'gpt-4',
    })
  })

  it('should work within a run context', async () => {
    const ctx = createRunContext('TestAgent')

    await runInContext(ctx, async () => {
      const fn = wrapTool('contextual', async () => 'result')
      await fn()

      expect(capturedEvents[0].run_id).toBe(ctx.run_id)
      expect(capturedEvents[0].trace_id).toBe(ctx.trace_id)
    })
  })

  it('should create temporary context if none active', async () => {
    const fn = wrapTool('noContext', async () => 'result')
    await fn()

    expect(capturedEvents[0].run_id).toBeDefined()
    expect(capturedEvents[0].trace_id).toBeDefined()
    expect(capturedEvents[0].run_id).toMatch(/^run_/)
    expect(capturedEvents[0].trace_id).toMatch(/^trace_/)
  })

  it('should support multiple tool calls in sequence', async () => {
    const fn1 = wrapTool('first', async () => 'one')
    const fn2 = wrapTool('second', async () => 'two')
    const fn3 = wrapTool('third', async () => 'three')

    await fn1()
    await fn2()
    await fn3()

    expect(capturedEvents).toHaveLength(3)
    expect(capturedEvents[0].tool?.name).toBe('first')
    expect(capturedEvents[1].tool?.name).toBe('second')
    expect(capturedEvents[2].tool?.name).toBe('third')
  })

  it('should handle different input types', async () => {
    const fn = wrapTool('mixed', async (str: string, num: number, bool: boolean, obj: object) => {
      return { str, num, bool, obj }
    })

    await fn('text', 42, true, { key: 'value' })

    expect(capturedEvents[0].tool?.input).toEqual({
      arg0: 'text',
      arg1: 42,
      arg2: true,
      arg3: { key: 'value' },
    })
  })

  it('should work with async functions that return different types', async () => {
    const fnString = wrapTool('returnString', async () => 'string')
    const fnNumber = wrapTool('returnNumber', async () => 42)
    const fnArray = wrapTool('returnArray', async () => [1, 2, 3])
    const fnNull = wrapTool('returnNull', async () => null)

    const r1 = await fnString()
    const r2 = await fnNumber()
    const r3 = await fnArray()
    const r4 = await fnNull()

    expect(r1).toBe('string')
    expect(r2).toBe(42)
    expect(r3).toEqual([1, 2, 3])
    expect(r4).toBeNull()
  })

  it('should not double-log when called multiple times', async () => {
    const fn = wrapTool('multi', async (n: number) => n * 2)

    await fn(5)
    await fn(10)
    await fn(15)

    expect(capturedEvents).toHaveLength(3)
    expect(capturedEvents[0].tool?.output).toBe(10)
    expect(capturedEvents[1].tool?.output).toBe(20)
    expect(capturedEvents[2].tool?.output).toBe(30)
  })

  it('should maintain tool name across multiple calls', async () => {
    const fn = wrapTool('consistent', async (x: number) => x)

    await fn(1)
    await fn(2)
    await fn(3)

    expect(capturedEvents.every((e) => e.tool?.name === 'consistent')).toBe(true)
  })
})
