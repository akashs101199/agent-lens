import { describe, it, expect, beforeEach, vi } from 'vitest'
import { wrapOpenAI } from '../src/openai.js'
import { setToolTransport, type ToolTransportConfig } from '../src/tool.js'
import { runInContext, createRunContext } from '@agentlens/core'

describe('OpenAI SDK Interceptor', () => {
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

  it('should wrap an OpenAI client', () => {
    const mockClient = {
      chat: {
        completions: {
          create: vi.fn(),
        },
      },
    }

    const wrapped = wrapOpenAI(mockClient)

    expect(wrapped).toBeDefined()
    expect(wrapped.chat).toBeDefined()
    expect(wrapped.chat.completions).toBeDefined()
    expect(wrapped.chat.completions.create).toBeDefined()
  })

  it('should intercept chat.completions.create calls', async () => {
    const mockResponse = {
      id: 'chatcmpl_123',
      object: 'chat.completion',
      model: 'gpt-4o',
      finish_reason: 'stop',
      usage: {
        prompt_tokens: 100,
        completion_tokens: 50,
      },
    }

    const mockClient = {
      chat: {
        completions: {
          create: vi.fn().mockResolvedValue(mockResponse),
        },
      },
    }

    const wrapped = wrapOpenAI(mockClient)
    const result = await wrapped.chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: 'Hello' }],
    })

    expect(result).toBe(mockResponse)
    expect(capturedEvents).toHaveLength(1)
  })

  it('should log LLM_CALL events', async () => {
    const mockClient = {
      chat: {
        completions: {
          create: vi.fn().mockResolvedValue({
            model: 'gpt-4o',
            finish_reason: 'stop',
            usage: {
              prompt_tokens: 100,
              completion_tokens: 50,
            },
          }),
        },
      },
    }

    const wrapped = wrapOpenAI(mockClient)
    await wrapped.chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: 'Hello' }],
    })

    expect(capturedEvents[0].schema_type).toBe('LLM_CALL')
    expect(capturedEvents[0].llm?.provider).toBe('openai')
    expect(capturedEvents[0].llm?.model).toBe('gpt-4o')
  })

  it('should extract token usage', async () => {
    const mockClient = {
      chat: {
        completions: {
          create: vi.fn().mockResolvedValue({
            model: 'gpt-4o-mini',
            finish_reason: 'stop',
            usage: {
              prompt_tokens: 250,
              completion_tokens: 100,
            },
          }),
        },
      },
    }

    const wrapped = wrapOpenAI(mockClient)
    await wrapped.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: 'Test' }],
    })

    expect(capturedEvents[0].llm?.prompt_tokens).toBe(250)
    expect(capturedEvents[0].llm?.completion_tokens).toBe(100)
    expect(capturedEvents[0].llm?.total_tokens).toBe(350)
  })

  it('should calculate cost correctly for gpt-4o', async () => {
    const mockClient = {
      chat: {
        completions: {
          create: vi.fn().mockResolvedValue({
            model: 'gpt-4o',
            finish_reason: 'stop',
            usage: {
              prompt_tokens: 1_000_000,
              completion_tokens: 1_000_000,
            },
          }),
        },
      },
    }

    const wrapped = wrapOpenAI(mockClient)
    await wrapped.chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: 'Test' }],
    })

    // GPT-4o: $2.50 per 1M input + $10 per 1M output = $12.50
    const expectedCost = 2.5 + 10.0
    expect(capturedEvents[0].llm?.cost_usd).toBe(expectedCost)
  })

  it('should calculate cost correctly for gpt-4o-mini', async () => {
    const mockClient = {
      chat: {
        completions: {
          create: vi.fn().mockResolvedValue({
            model: 'gpt-4o-mini',
            finish_reason: 'stop',
            usage: {
              prompt_tokens: 1_000_000,
              completion_tokens: 1_000_000,
            },
          }),
        },
      },
    }

    const wrapped = wrapOpenAI(mockClient)
    await wrapped.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: 'Test' }],
    })

    // GPT-4o-mini: $0.15 per 1M input + $0.60 per 1M output = $0.75
    const expectedCost = 0.15 + 0.6
    expect(capturedEvents[0].llm?.cost_usd).toBe(expectedCost)
  })

  it('should calculate cost correctly for o1', async () => {
    const mockClient = {
      chat: {
        completions: {
          create: vi.fn().mockResolvedValue({
            model: 'o1',
            finish_reason: 'stop',
            usage: {
              prompt_tokens: 1_000_000,
              completion_tokens: 1_000_000,
            },
          }),
        },
      },
    }

    const wrapped = wrapOpenAI(mockClient)
    await wrapped.chat.completions.create({
      model: 'o1',
      messages: [{ role: 'user', content: 'Test' }],
    })

    // o1: $15 per 1M input + $60 per 1M output = $75
    const expectedCost = 15.0 + 60.0
    expect(capturedEvents[0].llm?.cost_usd).toBe(expectedCost)
  })

  it('should measure latency', async () => {
    const mockClient = {
      chat: {
        completions: {
          create: vi.fn(async () => {
            await new Promise((resolve) => setTimeout(resolve, 50))
            return {
              model: 'gpt-4o',
              finish_reason: 'stop',
              usage: { prompt_tokens: 10, completion_tokens: 5 },
            }
          }),
        },
      },
    }

    const wrapped = wrapOpenAI(mockClient)
    await wrapped.chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: 'Test' }],
    })

    const latency = capturedEvents[0].llm?.latency_ms
    expect(latency).toBeGreaterThanOrEqual(40)
    expect(latency).toBeLessThan(200)
  })

  it('should capture finish_reason', async () => {
    const mockClient = {
      chat: {
        completions: {
          create: vi.fn().mockResolvedValue({
            model: 'gpt-4o',
            finish_reason: 'length',
            usage: { prompt_tokens: 10, completion_tokens: 5 },
          }),
        },
      },
    }

    const wrapped = wrapOpenAI(mockClient)
    await wrapped.chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: 'Test' }],
    })

    expect(capturedEvents[0].llm?.finish_reason).toBe('length')
  })

  it('should handle missing usage in response', async () => {
    const mockClient = {
      chat: {
        completions: {
          create: vi.fn().mockResolvedValue({
            model: 'gpt-4o',
            finish_reason: 'stop',
            // No usage field
          }),
        },
      },
    }

    const wrapped = wrapOpenAI(mockClient)
    await wrapped.chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: 'Test' }],
    })

    expect(capturedEvents[0].llm?.prompt_tokens).toBe(0)
    expect(capturedEvents[0].llm?.completion_tokens).toBe(0)
    expect(capturedEvents[0].llm?.cost_usd).toBe(0)
  })

  it('should handle errors and log them', async () => {
    const testError = new Error('API Error: Rate limit exceeded')

    const mockClient = {
      chat: {
        completions: {
          create: vi.fn().mockRejectedValue(testError),
        },
      },
    }

    const wrapped = wrapOpenAI(mockClient)

    await expect(
      wrapped.chat.completions.create({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: 'Test' }],
      }),
    ).rejects.toThrow('API Error: Rate limit exceeded')

    expect(capturedEvents).toHaveLength(1)
    expect(capturedEvents[0].llm?.finish_reason).toBe('error')
    expect(capturedEvents[0].metadata?.openai_error).toBe('API Error: Rate limit exceeded')
  })

  it('should re-throw original errors unchanged', async () => {
    const customError = new Error('Custom error')
    Object.assign(customError, { code: 'CUSTOM_CODE' })

    const mockClient = {
      chat: {
        completions: {
          create: vi.fn().mockRejectedValue(customError),
        },
      },
    }

    const wrapped = wrapOpenAI(mockClient)

    try {
      await wrapped.chat.completions.create({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: 'Test' }],
      })
      expect.fail('Should have thrown')
    } catch (error) {
      expect(error).toBe(customError)
      expect((error as any).code).toBe('CUSTOM_CODE')
    }
  })

  it('should work within a run context', async () => {
    const ctx = createRunContext('TestAgent')

    const mockClient = {
      chat: {
        completions: {
          create: vi.fn().mockResolvedValue({
            model: 'gpt-4o',
            finish_reason: 'stop',
            usage: { prompt_tokens: 10, completion_tokens: 5 },
          }),
        },
      },
    }

    await runInContext(ctx, async () => {
      const wrapped = wrapOpenAI(mockClient)
      await wrapped.chat.completions.create({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: 'Test' }],
      })

      expect(capturedEvents[0].run_id).toBe(ctx.run_id)
      expect(capturedEvents[0].trace_id).toBe(ctx.trace_id)
    })
  })

  it('should support multiple models in same session', async () => {
    const mockClient = {
      chat: {
        completions: {
          create: vi.fn((params: any) =>
            Promise.resolve({
              model: params.model,
              finish_reason: 'stop',
              usage: { prompt_tokens: 10, completion_tokens: 5 },
            }),
          ),
        },
      },
    }

    const wrapped = wrapOpenAI(mockClient)

    await wrapped.chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: 'Test' }],
    })

    await wrapped.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: 'Test' }],
    })

    await wrapped.chat.completions.create({
      model: 'o1-mini',
      messages: [{ role: 'user', content: 'Test' }],
    })

    expect(capturedEvents).toHaveLength(3)
    expect(capturedEvents[0].llm?.model).toBe('gpt-4o')
    expect(capturedEvents[1].llm?.model).toBe('gpt-4o-mini')
    expect(capturedEvents[2].llm?.model).toBe('o1-mini')
  })

  it('should handle unknown models gracefully', async () => {
    const mockClient = {
      chat: {
        completions: {
          create: vi.fn().mockResolvedValue({
            model: 'unknown-model-xyz',
            finish_reason: 'stop',
            usage: { prompt_tokens: 10, completion_tokens: 5 },
          }),
        },
      },
    }

    const wrapped = wrapOpenAI(mockClient)
    await wrapped.chat.completions.create({
      model: 'unknown-model-xyz',
      messages: [{ role: 'user', content: 'Test' }],
    })

    // Should not crash, cost should be 0 for unknown model
    expect(capturedEvents[0].llm?.cost_usd).toBe(0)
  })

  it('should handle missing model parameter', async () => {
    const mockClient = {
      chat: {
        completions: {
          create: vi.fn().mockResolvedValue({
            // No model in response
            finish_reason: 'stop',
            usage: { prompt_tokens: 10, completion_tokens: 5 },
          }),
        },
      },
    }

    const wrapped = wrapOpenAI(mockClient)
    const params: any = {
      messages: [{ role: 'user', content: 'Test' }],
    }
    // Don't set model property at all
    await wrapped.chat.completions.create(params)

    expect(capturedEvents[0].llm?.model).toBe('unknown')
  })

  it('should preserve client functionality', async () => {
    const expectedResponse = {
      id: 'chatcmpl_123',
      object: 'chat.completion',
      model: 'gpt-4o',
      finish_reason: 'stop',
      choices: [{ message: { role: 'assistant', content: 'Response text' } }],
      usage: { prompt_tokens: 10, completion_tokens: 5 },
    }

    const mockClient = {
      chat: {
        completions: {
          create: vi.fn().mockResolvedValue(expectedResponse),
        },
      },
    }

    const wrapped = wrapOpenAI(mockClient)
    const result = await wrapped.chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: 'Test' }],
    })

    expect(result).toEqual(expectedResponse)
    expect((result as any).choices[0].message.content).toBe('Response text')
  })

  it('should handle partial token usage', async () => {
    const mockClient = {
      chat: {
        completions: {
          create: vi.fn().mockResolvedValue({
            model: 'gpt-4o',
            finish_reason: 'stop',
            usage: {
              prompt_tokens: 100,
              // Missing completion_tokens
            },
          }),
        },
      },
    }

    const wrapped = wrapOpenAI(mockClient)
    await wrapped.chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: 'Test' }],
    })

    expect(capturedEvents[0].llm?.prompt_tokens).toBe(100)
    expect(capturedEvents[0].llm?.completion_tokens).toBe(0)
  })

  it('should maintain consistency across multiple calls', async () => {
    const mockClient = {
      chat: {
        completions: {
          create: vi.fn(async () => {
            await new Promise((resolve) => setTimeout(resolve, 10))
            return {
              model: 'gpt-4o',
              finish_reason: 'stop',
              usage: { prompt_tokens: 20, completion_tokens: 10 },
            }
          }),
        },
      },
    }

    const wrapped = wrapOpenAI(mockClient)

    for (let i = 0; i < 5; i++) {
      await wrapped.chat.completions.create({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: `Test ${i}` }],
      })
    }

    expect(capturedEvents).toHaveLength(5)
    expect(capturedEvents.every((e) => e.llm?.provider === 'openai')).toBe(true)
    expect(capturedEvents.every((e) => e.llm?.model === 'gpt-4o')).toBe(true)
  })
})
