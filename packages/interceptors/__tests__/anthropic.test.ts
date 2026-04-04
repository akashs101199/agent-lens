import { describe, it, expect, beforeEach, vi } from 'vitest'
import { wrapAnthropic } from '../src/anthropic.js'
import { setToolTransport, type ToolTransportConfig } from '../src/tool.js'
import { runInContext, createRunContext } from '@agentlens/core'

describe('Anthropic SDK Interceptor', () => {
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

  it('should wrap an Anthropic client', () => {
    const mockClient = {
      messages: {
        create: vi.fn(),
      },
    }

    const wrapped = wrapAnthropic(mockClient)

    expect(wrapped).toBeDefined()
    expect(wrapped.messages).toBeDefined()
    expect(wrapped.messages.create).toBeDefined()
  })

  it('should intercept messages.create calls', async () => {
    const mockResponse = {
      id: 'msg_123',
      type: 'message',
      role: 'assistant',
      content: [{ type: 'text', text: 'Hello!' }],
      model: 'claude-sonnet-4-20250514',
      stop_reason: 'end_turn',
      usage: {
        input_tokens: 100,
        output_tokens: 50,
      },
    }

    const mockClient = {
      messages: {
        create: vi.fn().mockResolvedValue(mockResponse),
      },
    }

    const wrapped = wrapAnthropic(mockClient)
    const result = await wrapped.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      messages: [{ role: 'user', content: 'Hello' }],
    })

    expect(result).toBe(mockResponse)
    expect(capturedEvents).toHaveLength(1)
  })

  it('should log LLM_CALL events', async () => {
    const mockClient = {
      messages: {
        create: vi.fn().mockResolvedValue({
          id: 'msg_123',
          model: 'claude-sonnet-4-20250514',
          stop_reason: 'end_turn',
          usage: {
            input_tokens: 100,
            output_tokens: 50,
          },
        }),
      },
    }

    const wrapped = wrapAnthropic(mockClient)
    await wrapped.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      messages: [{ role: 'user', content: 'Hello' }],
    })

    expect(capturedEvents[0].schema_type).toBe('LLM_CALL')
    expect(capturedEvents[0].llm?.provider).toBe('anthropic')
    expect(capturedEvents[0].llm?.model).toBe('claude-sonnet-4-20250514')
  })

  it('should extract token usage', async () => {
    const mockClient = {
      messages: {
        create: vi.fn().mockResolvedValue({
          model: 'claude-haiku-4-20250514',
          stop_reason: 'end_turn',
          usage: {
            input_tokens: 250,
            output_tokens: 100,
          },
        }),
      },
    }

    const wrapped = wrapAnthropic(mockClient)
    await wrapped.messages.create({
      model: 'claude-haiku-4-20250514',
      max_tokens: 1024,
      messages: [{ role: 'user', content: 'Test' }],
    })

    expect(capturedEvents[0].llm?.prompt_tokens).toBe(250)
    expect(capturedEvents[0].llm?.completion_tokens).toBe(100)
    expect(capturedEvents[0].llm?.total_tokens).toBe(350)
  })

  it('should calculate cost correctly for claude-sonnet', async () => {
    const mockClient = {
      messages: {
        create: vi.fn().mockResolvedValue({
          model: 'claude-sonnet-4-20250514',
          stop_reason: 'end_turn',
          usage: {
            input_tokens: 1_000_000,
            output_tokens: 1_000_000,
          },
        }),
      },
    }

    const wrapped = wrapAnthropic(mockClient)
    await wrapped.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      messages: [{ role: 'user', content: 'Test' }],
    })

    // Sonnet: $3 per 1M input + $15 per 1M output = $18 per 1M tokens
    const expectedCost = 3.0 + 15.0
    expect(capturedEvents[0].llm?.cost_usd).toBe(expectedCost)
  })

  it('should calculate cost correctly for claude-haiku', async () => {
    const mockClient = {
      messages: {
        create: vi.fn().mockResolvedValue({
          model: 'claude-haiku-4-20250514',
          stop_reason: 'end_turn',
          usage: {
            input_tokens: 1_000_000,
            output_tokens: 1_000_000,
          },
        }),
      },
    }

    const wrapped = wrapAnthropic(mockClient)
    await wrapped.messages.create({
      model: 'claude-haiku-4-20250514',
      max_tokens: 2000,
      messages: [{ role: 'user', content: 'Test' }],
    })

    // Haiku: $0.80 per 1M input + $4 per 1M output = $4.80
    const expectedCost = 0.8 + 4.0
    expect(capturedEvents[0].llm?.cost_usd).toBe(expectedCost)
  })

  it('should measure latency', async () => {
    const mockClient = {
      messages: {
        create: vi.fn(async () => {
          await new Promise((resolve) => setTimeout(resolve, 50))
          return {
            model: 'claude-sonnet-4-20250514',
            stop_reason: 'end_turn',
            usage: { input_tokens: 10, output_tokens: 5 },
          }
        }),
      },
    }

    const wrapped = wrapAnthropic(mockClient)
    await wrapped.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      messages: [{ role: 'user', content: 'Test' }],
    })

    const latency = capturedEvents[0].llm?.latency_ms
    expect(latency).toBeGreaterThanOrEqual(40)
    expect(latency).toBeLessThan(200)
  })

  it('should capture finish_reason', async () => {
    const mockClient = {
      messages: {
        create: vi.fn().mockResolvedValue({
          model: 'claude-sonnet-4-20250514',
          stop_reason: 'max_tokens',
          usage: { input_tokens: 10, output_tokens: 5 },
        }),
      },
    }

    const wrapped = wrapAnthropic(mockClient)
    await wrapped.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      messages: [{ role: 'user', content: 'Test' }],
    })

    expect(capturedEvents[0].llm?.finish_reason).toBe('max_tokens')
  })

  it('should handle missing usage in response', async () => {
    const mockClient = {
      messages: {
        create: vi.fn().mockResolvedValue({
          model: 'claude-sonnet-4-20250514',
          stop_reason: 'end_turn',
          // No usage field
        }),
      },
    }

    const wrapped = wrapAnthropic(mockClient)
    await wrapped.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      messages: [{ role: 'user', content: 'Test' }],
    })

    expect(capturedEvents[0].llm?.prompt_tokens).toBe(0)
    expect(capturedEvents[0].llm?.completion_tokens).toBe(0)
    expect(capturedEvents[0].llm?.cost_usd).toBe(0)
  })

  it('should handle errors and log them', async () => {
    const testError = new Error('API Error: Rate limited')

    const mockClient = {
      messages: {
        create: vi.fn().mockRejectedValue(testError),
      },
    }

    const wrapped = wrapAnthropic(mockClient)

    await expect(
      wrapped.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1024,
        messages: [{ role: 'user', content: 'Test' }],
      }),
    ).rejects.toThrow('API Error: Rate limited')

    expect(capturedEvents).toHaveLength(1)
    expect(capturedEvents[0].llm?.finish_reason).toBe('error')
    expect(capturedEvents[0].metadata?.anthropic_error).toBe('API Error: Rate limited')
  })

  it('should re-throw original errors unchanged', async () => {
    const customError = new Error('Custom error')
    Object.assign(customError, { code: 'CUSTOM_ERROR' })

    const mockClient = {
      messages: {
        create: vi.fn().mockRejectedValue(customError),
      },
    }

    const wrapped = wrapAnthropic(mockClient)

    try {
      await wrapped.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1024,
        messages: [{ role: 'user', content: 'Test' }],
      })
      expect.fail('Should have thrown')
    } catch (error) {
      expect(error).toBe(customError)
      expect((error as any).code).toBe('CUSTOM_ERROR')
    }
  })

  it('should work within a run context', async () => {
    const ctx = createRunContext('TestAgent')

    const mockClient = {
      messages: {
        create: vi.fn().mockResolvedValue({
          model: 'claude-sonnet-4-20250514',
          stop_reason: 'end_turn',
          usage: { input_tokens: 10, output_tokens: 5 },
        }),
      },
    }

    await runInContext(ctx, async () => {
      const wrapped = wrapAnthropic(mockClient)
      await wrapped.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1024,
        messages: [{ role: 'user', content: 'Test' }],
      })

      expect(capturedEvents[0].run_id).toBe(ctx.run_id)
      expect(capturedEvents[0].trace_id).toBe(ctx.trace_id)
    })
  })

  it('should support multiple models in same session', async () => {
    const mockClient = {
      messages: {
        create: vi.fn((params: any) =>
          Promise.resolve({
            model: params.model,
            stop_reason: 'end_turn',
            usage: { input_tokens: 10, output_tokens: 5 },
          }),
        ),
      },
    }

    const wrapped = wrapAnthropic(mockClient)

    await wrapped.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      messages: [{ role: 'user', content: 'Test' }],
    })

    await wrapped.messages.create({
      model: 'claude-haiku-4-20250514',
      max_tokens: 1024,
      messages: [{ role: 'user', content: 'Test' }],
    })

    expect(capturedEvents).toHaveLength(2)
    expect(capturedEvents[0].llm?.model).toBe('claude-sonnet-4-20250514')
    expect(capturedEvents[1].llm?.model).toBe('claude-haiku-4-20250514')
  })

  it('should handle unknown models gracefully', async () => {
    const mockClient = {
      messages: {
        create: vi.fn().mockResolvedValue({
          model: 'unknown-model-xyz',
          stop_reason: 'end_turn',
          usage: { input_tokens: 10, output_tokens: 5 },
        }),
      },
    }

    const wrapped = wrapAnthropic(mockClient)
    await wrapped.messages.create({
      model: 'unknown-model-xyz',
      max_tokens: 1024,
      messages: [{ role: 'user', content: 'Test' }],
    })

    // Should not crash, cost should be 0 for unknown model
    expect(capturedEvents[0].llm?.cost_usd).toBe(0)
  })

  it('should handle missing model parameter', async () => {
    const mockClient = {
      messages: {
        create: vi.fn().mockResolvedValue({
          // No model in response
          stop_reason: 'end_turn',
          usage: { input_tokens: 10, output_tokens: 5 },
        }),
      },
    }

    const wrapped = wrapAnthropic(mockClient)
    await wrapped.messages.create({
      // No model in request
      max_tokens: 1024,
      messages: [{ role: 'user', content: 'Test' }],
    })

    expect(capturedEvents[0].llm?.model).toBe('unknown')
  })

  it('should preserve client functionality', async () => {
    const expectedResponse = {
      id: 'msg_123',
      model: 'claude-sonnet-4-20250514',
      stop_reason: 'end_turn',
      content: [{ type: 'text', text: 'Response text' }],
      usage: { input_tokens: 10, output_tokens: 5 },
    }

    const mockClient = {
      messages: {
        create: vi.fn().mockResolvedValue(expectedResponse),
      },
    }

    const wrapped = wrapAnthropic(mockClient)
    const result = await wrapped.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      messages: [{ role: 'user', content: 'Test' }],
    })

    expect(result).toEqual(expectedResponse)
    expect(result.content[0].text).toBe('Response text')
  })
})
