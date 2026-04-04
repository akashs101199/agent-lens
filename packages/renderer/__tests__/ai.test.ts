import { describe, it, expect } from 'vitest'
import { renderEventAI, renderSequenceAI } from '../src/ai.js'
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

describe('AI Renderer', () => {
  describe('renderEventAI', () => {
    it('should output valid JSON on a single line', () => {
      const event = createTestEvent({
        schema_type: 'AGENT_START',
      })

      const json = renderEventAI(event)

      // Should be valid JSON
      expect(() => JSON.parse(json)).not.toThrow()

      // Should be a single line (no newlines)
      expect(json).not.toContain('\n')
    })

    it('should include _claude_context field', () => {
      const event = createTestEvent({
        schema_type: 'AGENT_START',
      })

      const json = renderEventAI(event)
      const parsed = JSON.parse(json) as Record<string, unknown>

      expect(parsed._claude_context).toBeDefined()
      expect(parsed._claude_context).toHaveProperty('summary')
    })

    it('should generate summary for AGENT_START', () => {
      const event = createTestEvent({
        schema_type: 'AGENT_START',
        agent: { name: 'ResearchAgent', phase: 'PLAN' },
      })

      const json = renderEventAI(event)
      const parsed = JSON.parse(json) as Record<string, any>

      expect(parsed._claude_context.summary).toContain('ResearchAgent')
      expect(parsed._claude_context.summary).toContain('started')
    })

    it('should generate summary for AGENT_END', () => {
      const event = createTestEvent({
        schema_type: 'AGENT_END',
        step_index: 5,
      })

      const json = renderEventAI(event)
      const parsed = JSON.parse(json) as Record<string, any>

      expect(parsed._claude_context.summary).toContain('completed')
      expect(parsed._claude_context.summary).toContain('5 steps')
    })

    it('should generate summary for TOOL_CALL with SUCCESS', () => {
      const event = createTestEvent({
        schema_type: 'TOOL_CALL',
        tool: {
          name: 'web_search',
          input: {},
          output: 'results',
          status: 'SUCCESS',
          duration_ms: 1500,
        },
      })

      const json = renderEventAI(event)
      const parsed = JSON.parse(json) as Record<string, any>

      expect(parsed._claude_context.summary).toContain('web_search')
      expect(parsed._claude_context.summary).toContain('success')
      expect(parsed._claude_context.summary).toContain('1.50s')
    })

    it('should generate summary for LLM_CALL', () => {
      const event = createTestEvent({
        schema_type: 'LLM_CALL',
        llm: {
          model: 'claude-sonnet-4-20250514',
          provider: 'anthropic',
          prompt_tokens: 1200,
          completion_tokens: 340,
          total_tokens: 1540,
          cost_usd: 0.0048,
          latency_ms: 1320,
          finish_reason: 'end_turn',
        },
      })

      const json = renderEventAI(event)
      const parsed = JSON.parse(json) as Record<string, any>

      expect(parsed._claude_context.summary).toContain('claude-sonnet-4-20250514')
      expect(parsed._claude_context.summary).toContain('1540')
    })

    it('should generate summary for ERROR', () => {
      const event = createTestEvent({
        schema_type: 'ERROR',
        error: {
          code: 'CONTEXT_OVERFLOW',
          message: 'Token limit exceeded',
          recoverable: true,
        },
      })

      const json = renderEventAI(event)
      const parsed = JSON.parse(json) as Record<string, any>

      expect(parsed._claude_context.summary).toContain('CONTEXT_OVERFLOW')
      expect(parsed._claude_context.summary).toContain('Token limit exceeded')
    })

    it('should generate debug suggestions for slow tool calls', () => {
      const event = createTestEvent({
        schema_type: 'TOOL_CALL',
        tool: {
          name: 'slow_tool',
          input: {},
          output: 'result',
          status: 'SUCCESS',
          duration_ms: 6000,
        },
      })

      const json = renderEventAI(event)
      const parsed = JSON.parse(json) as Record<string, any>

      expect(parsed._claude_context.debug_suggestion).toBeDefined()
      expect(parsed._claude_context.debug_suggestion).toContain('6.00s')
      expect(parsed._claude_context.debug_suggestion).toContain('caching')
    })

    it('should generate debug suggestions for failed tool calls', () => {
      const event = createTestEvent({
        schema_type: 'TOOL_CALL',
        tool: {
          name: 'failing_tool',
          input: {},
          output: undefined,
          status: 'FAILURE',
          duration_ms: 500,
          error_message: 'API error',
        },
      })

      const json = renderEventAI(event)
      const parsed = JSON.parse(json) as Record<string, any>

      expect(parsed._claude_context.debug_suggestion).toBeDefined()
      expect(parsed._claude_context.debug_suggestion).toContain('API error')
    })

    it('should generate debug suggestions for CONTEXT_OVERFLOW errors', () => {
      const event = createTestEvent({
        schema_type: 'ERROR',
        error: {
          code: 'CONTEXT_OVERFLOW',
          message: 'Token limit exceeded',
          recoverable: true,
        },
      })

      const json = renderEventAI(event)
      const parsed = JSON.parse(json) as Record<string, any>

      expect(parsed._claude_context.debug_suggestion).toContain('Context window')
    })

    it('should generate debug suggestions for LOOP_DETECTED errors', () => {
      const event = createTestEvent({
        schema_type: 'ERROR',
        error: {
          code: 'LOOP_DETECTED',
          message: 'Infinite loop detected',
          recoverable: false,
        },
      })

      const json = renderEventAI(event)
      const parsed = JSON.parse(json) as Record<string, any>

      expect(parsed._claude_context.debug_suggestion).toContain('loop')
    })

    it('should use ai_debug_hint when present', () => {
      const event = createTestEvent({
        schema_type: 'TOOL_CALL',
        tool: {
          name: 'test_tool',
          input: {},
          output: 'result',
          status: 'SUCCESS',
          duration_ms: 100,
        },
        ai_debug_hint: 'Custom debug hint from event',
      })

      const json = renderEventAI(event)
      const parsed = JSON.parse(json) as Record<string, any>

      expect(parsed._claude_context.debug_suggestion).toBe('Custom debug hint from event')
    })

    it('should preserve all original ARLS fields', () => {
      const event = createTestEvent({
        schema_type: 'LLM_CALL',
        llm: {
          model: 'test-model',
          provider: 'openai',
          prompt_tokens: 100,
          completion_tokens: 50,
          total_tokens: 150,
          cost_usd: 0.005,
          latency_ms: 500,
          finish_reason: 'stop',
        },
      })

      const json = renderEventAI(event)
      const parsed = JSON.parse(json) as Record<string, any>

      expect(parsed.agentlens_version).toBe('1.0')
      expect(parsed.schema_type).toBe('LLM_CALL')
      expect(parsed.trace_id).toBe('trace_abc123')
      expect(parsed.run_id).toBe('run_123')
      expect(parsed.llm).toBeDefined()
      expect(parsed.llm.model).toBe('test-model')
    })

    it('should not include undefined fields in _claude_context', () => {
      const event = createTestEvent({
        schema_type: 'AGENT_START',
      })

      const json = renderEventAI(event)
      const parsed = JSON.parse(json) as Record<string, any>

      // Should only have summary (no debug_suggestion, related_steps, or cost_so_far_usd)
      expect(Object.keys(parsed._claude_context)).toEqual(['summary'])
    })

    it('should include cost_so_far_usd when in metadata', () => {
      const event = createTestEvent({
        schema_type: 'LLM_CALL',
        metadata: {
          cost_so_far_usd: 0.0125,
        },
        llm: {
          model: 'test-model',
          provider: 'openai',
          prompt_tokens: 100,
          completion_tokens: 50,
          total_tokens: 150,
          cost_usd: 0.005,
          latency_ms: 500,
          finish_reason: 'stop',
        },
      })

      const json = renderEventAI(event)
      const parsed = JSON.parse(json) as Record<string, any>

      expect(parsed._claude_context.cost_so_far_usd).toBe(0.0125)
    })

    it('should be compact (no pretty-printing)', () => {
      const event = createTestEvent({
        schema_type: 'AGENT_START',
      })

      const json = renderEventAI(event)

      // Should be compact JSON (no extra whitespace)
      expect(json).not.toMatch(/\n/)
      expect(json).not.toMatch(/  /)
    })
  })

  describe('renderSequenceAI', () => {
    it('should render multiple events as JSONL', () => {
      const events = [
        createTestEvent({
          schema_type: 'AGENT_START',
          step_index: 0,
        }),
        createTestEvent({
          schema_type: 'TOOL_CALL',
          step_index: 1,
          tool: {
            name: 'test_tool',
            input: {},
            output: 'result',
            status: 'SUCCESS',
            duration_ms: 100,
          },
        }),
        createTestEvent({
          schema_type: 'AGENT_END',
          step_index: 2,
        }),
      ]

      const jsonl = renderSequenceAI(events)
      const lines = jsonl.split('\n')

      expect(lines).toHaveLength(3)

      // Each line should be valid JSON
      for (const line of lines) {
        expect(() => JSON.parse(line)).not.toThrow()
      }

      // First line should be AGENT_START
      const first = JSON.parse(lines[0]) as Record<string, any>
      expect(first.schema_type).toBe('AGENT_START')

      // Last line should be AGENT_END
      const last = JSON.parse(lines[2]) as Record<string, any>
      expect(last.schema_type).toBe('AGENT_END')
    })

    it('should handle empty event array', () => {
      const jsonl = renderSequenceAI([])
      expect(jsonl).toBe('')
    })

    it('should handle single event', () => {
      const event = createTestEvent({
        schema_type: 'AGENT_START',
      })

      const jsonl = renderSequenceAI([event])
      const lines = jsonl.split('\n')

      expect(lines).toHaveLength(1)
      expect(() => JSON.parse(lines[0])).not.toThrow()
    })

    it('should preserve event order', () => {
      const events = [
        createTestEvent({ step_index: 0 }),
        createTestEvent({ step_index: 1 }),
        createTestEvent({ step_index: 2 }),
        createTestEvent({ step_index: 3 }),
      ]

      const jsonl = renderSequenceAI(events)
      const lines = jsonl.split('\n')

      for (let i = 0; i < lines.length; i++) {
        const parsed = JSON.parse(lines[i]) as Record<string, any>
        expect(parsed.step_index).toBe(i)
      }
    })

    it('should include _claude_context in each line', () => {
      const events = [
        createTestEvent({ schema_type: 'AGENT_START' }),
        createTestEvent({ schema_type: 'AGENT_END' }),
      ]

      const jsonl = renderSequenceAI(events)
      const lines = jsonl.split('\n')

      for (const line of lines) {
        const parsed = JSON.parse(line) as Record<string, any>
        expect(parsed._claude_context).toBeDefined()
        expect(parsed._claude_context.summary).toBeDefined()
      }
    })
  })
})
