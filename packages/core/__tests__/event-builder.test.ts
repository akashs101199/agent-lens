import { describe, it, expect } from 'vitest'
import {
  buildLLMEvent,
  buildToolEvent,
  buildAgentStartEvent,
  buildAgentEndEvent,
  buildErrorEvent,
  type LLMCallInput,
  type ToolCallInput,
} from '../src/event-builder.js'
import { ARLS_VERSION, type ARLSEvent } from '../src/schema.js'
import { runInContext, createRunContext } from '../src/context.js'

describe('Event Builder', () => {
  it('should build a valid LLM_CALL event', () => {
    const input: LLMCallInput = {
      model: 'claude-3-sonnet',
      provider: 'anthropic',
      prompt_tokens: 100,
      completion_tokens: 50,
      cost_usd: 0.001,
      latency_ms: 500,
      finish_reason: 'end_turn',
    }

    const event = buildLLMEvent(input, 'TestAgent', 'RESPOND')

    expect(event.schema_type).toBe('LLM_CALL')
    expect(event.agentlens_version).toBe(ARLS_VERSION)
    expect(event.llm?.model).toBe('claude-3-sonnet')
    expect(event.llm?.total_tokens).toBe(150)
    expect(event.agent.name).toBe('TestAgent')
    expect(event.agent.phase).toBe('RESPOND')
  })

  it('should build a valid TOOL_CALL event', () => {
    const input: ToolCallInput = {
      name: 'search',
      input: { query: 'test' },
      output: { results: [1, 2, 3] },
      status: 'SUCCESS',
      duration_ms: 1000,
    }

    const event = buildToolEvent(input, 'TestAgent', 'TOOL_CALL')

    expect(event.schema_type).toBe('TOOL_CALL')
    expect(event.tool?.name).toBe('search')
    expect(event.tool?.status).toBe('SUCCESS')
    expect(event.tool?.duration_ms).toBe(1000)
  })

  it('should build a valid AGENT_START event', () => {
    const event = buildAgentStartEvent('TestAgent', 'PLAN')

    expect(event.schema_type).toBe('AGENT_START')
    expect(event.agent.name).toBe('TestAgent')
    expect(event.agent.phase).toBe('PLAN')
  })

  it('should build a valid AGENT_END event', () => {
    const event = buildAgentEndEvent(
      {
        summary: 'Completed successfully',
        total_tokens: 500,
        total_cost_usd: 0.005,
        duration_ms: 2000,
      },
      'TestAgent',
    )

    expect(event.schema_type).toBe('AGENT_END')
    expect(event.agent.name).toBe('TestAgent')
    expect(event.metadata?.summary).toBe('Completed successfully')
  })

  it('should build a valid ERROR event from Error object', () => {
    const error = new Error('Test error')
    const event = buildErrorEvent(error, 'test_context', 'TestAgent')

    expect(event.schema_type).toBe('ERROR')
    expect(event.error?.message).toBe('Test error')
    expect(event.error?.recoverable).toBe(true)
    expect(event.agent.name).toBe('TestAgent')
  })

  it('should build ERROR event from string', () => {
    const event = buildErrorEvent('String error', 'context')

    expect(event.schema_type).toBe('ERROR')
    expect(event.error?.message).toBe('String error')
  })

  it('should detect CONTEXT_OVERFLOW debug hint', () => {
    const error = { code: 'CONTEXT_LIMIT', message: 'Context window exceeded' }
    const event = buildErrorEvent(error, 'context')

    expect(event.ai_debug_hint).toContain('CONTEXT_OVERFLOW')
  })

  it('should detect TOOL_FAILURE debug hint', () => {
    const error = { code: 'TOOL_ERROR', message: 'Tool execution failed' }
    const event = buildErrorEvent(error, 'context')

    expect(event.ai_debug_hint).toContain('TOOL_FAILURE')
  })

  it('should detect LOOP_DETECTED debug hint', () => {
    const error = { code: 'LOOP', message: 'Infinite loop detected' }
    const event = buildErrorEvent(error, 'context')

    expect(event.ai_debug_hint).toContain('LOOP_DETECTED')
  })

  it('should include timestamp in ISO 8601 format', () => {
    const event = buildLLMEvent(
      {
        model: 'test',
        provider: 'test',
        prompt_tokens: 0,
        completion_tokens: 0,
        cost_usd: 0,
        latency_ms: 0,
        finish_reason: 'test',
      },
      'TestAgent',
    )

    expect(event.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)
  })

  it('should use context when available', async () => {
    const ctx = createRunContext('TestAgent')

    await runInContext(ctx, async () => {
      const event = buildLLMEvent(
        {
          model: 'test',
          provider: 'test',
          prompt_tokens: 0,
          completion_tokens: 0,
          cost_usd: 0,
          latency_ms: 0,
          finish_reason: 'test',
        },
        'TestAgent',
      )

      expect(event.run_id).toBe(ctx.run_id)
      expect(event.trace_id).toBe(ctx.trace_id)
    })
  })

  it('should create temporary context if none exists', () => {
    const event = buildLLMEvent(
      {
        model: 'test',
        provider: 'test',
        prompt_tokens: 0,
        completion_tokens: 0,
        cost_usd: 0,
        latency_ms: 0,
        finish_reason: 'test',
      },
      'TestAgent',
    )

    expect(event.run_id).toMatch(/^run_/)
    expect(event.trace_id).toMatch(/^trace_/)
  })

  it('should handle error objects with custom properties', () => {
    const error = { code: 'CUSTOM', message: 'Custom error', recoverable: false } as unknown
    const event = buildErrorEvent(error, 'context')

    expect(event.error?.code).toBe('CUSTOM')
    expect(event.error?.message).toBe('Custom error')
    expect(event.error?.recoverable).toBe(false)
  })

  it('should handle TOOL_CALL with FAILURE status', () => {
    const input: ToolCallInput = {
      name: 'search',
      input: { query: 'test' },
      output: null,
      status: 'FAILURE',
      duration_ms: 500,
      error_message: 'Search failed',
    }

    const event = buildToolEvent(input)

    expect(event.tool?.status).toBe('FAILURE')
    expect(event.tool?.error_message).toBe('Search failed')
  })

  it('should support optional time_to_first_token_ms', () => {
    const input: LLMCallInput = {
      model: 'test',
      provider: 'test',
      prompt_tokens: 10,
      completion_tokens: 5,
      cost_usd: 0.001,
      latency_ms: 1000,
      finish_reason: 'end_turn',
      time_to_first_token_ms: 150,
    }

    const event = buildLLMEvent(input)

    expect(event.llm?.time_to_first_token_ms).toBe(150)
  })
})
