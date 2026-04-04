import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { renderEvent, renderSequence } from '../src/human.js'
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

describe('Human Renderer', () => {
  let originalNoColor: string | undefined
  let originalCI: string | undefined

  beforeEach(() => {
    originalNoColor = process.env.NO_COLOR
    originalCI = process.env.CI
    delete process.env.NO_COLOR
    delete process.env.CI
  })

  afterEach(() => {
    if (originalNoColor !== undefined) {
      process.env.NO_COLOR = originalNoColor
    } else {
      delete process.env.NO_COLOR
    }
    if (originalCI !== undefined) {
      process.env.CI = originalCI
    } else {
      delete process.env.CI
    }
  })

  describe('renderEvent', () => {
    it('should render AGENT_START events', () => {
      const event = createTestEvent({
        schema_type: 'AGENT_START',
        agent: { name: 'ResearchAgent', phase: 'PLAN' },
      })

      const lines = renderEvent(event)
      const output = lines.join('\n')

      expect(output).toContain('AGENT START')
      expect(output).toContain('ResearchAgent')
      expect(output).toContain('run_123')
      expect(output).toContain('trace_abc123')
    })

    it('should render AGENT_END events', () => {
      const event = createTestEvent({
        schema_type: 'AGENT_END',
        step_index: 5,
      })

      const lines = renderEvent(event)
      const output = lines.join('\n')

      expect(output).toContain('AGENT END')
      expect(output).toContain('run_123')
    })

    it('should render TOOL_CALL events with SUCCESS status', () => {
      const event = createTestEvent({
        schema_type: 'TOOL_CALL',
        tool: {
          name: 'web_search',
          input: { query: 'AI observability' },
          output: '[3 results]',
          status: 'SUCCESS',
          duration_ms: 842,
        },
      })

      const lines = renderEvent(event)
      const output = lines.join('\n')

      expect(output).toContain('TOOL CALL')
      expect(output).toContain('web_search')
      expect(output).toContain('SUCCESS')
      expect(output).toContain('842ms')
      expect(output).toContain('✅')
    })

    it('should render TOOL_CALL events with FAILURE status', () => {
      const event = createTestEvent({
        schema_type: 'TOOL_CALL',
        tool: {
          name: 'fetch_api',
          input: {},
          output: undefined,
          status: 'FAILURE',
          duration_ms: 1200,
          error_message: 'Connection timeout',
        },
      })

      const lines = renderEvent(event)
      const output = lines.join('\n')

      expect(output).toContain('FAILURE')
      expect(output).toContain('❌')
      expect(output).toContain('Connection timeout')
    })

    it('should render LLM_CALL events', () => {
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

      const lines = renderEvent(event)
      const output = lines.join('\n')

      expect(output).toContain('LLM CALL')
      expect(output).toContain('claude-sonnet-4-20250514')
      expect(output).toContain('1540')
      expect(output).toContain('1200 in / 340 out')
      expect(output).toContain('0.0048')
    })

    it('should render ERROR events', () => {
      const event = createTestEvent({
        schema_type: 'ERROR',
        error: {
          code: 'CONTEXT_OVERFLOW',
          message: 'Token limit exceeded',
          recoverable: true,
          recovery_hint: 'Summarize earlier messages',
        },
      })

      const lines = renderEvent(event)
      const output = lines.join('\n')

      expect(output).toContain('ERROR')
      expect(output).toContain('CONTEXT_OVERFLOW')
      expect(output).toContain('Token limit exceeded')
      expect(output).toContain('Summarize earlier messages')
    })

    it('should render REASONING_STEP events', () => {
      const event = createTestEvent({
        schema_type: 'REASONING_STEP',
        agent: { name: 'TestAgent', phase: 'REFLECT' },
        metadata: { content: 'Need to search for more context' },
      })

      const lines = renderEvent(event)
      const output = lines.join('\n')

      expect(output).toContain('REASONING')
      expect(output).toContain('Need to search for more context')
    })

    it('should render MEMORY_READ events', () => {
      const event = createTestEvent({
        schema_type: 'MEMORY_READ',
        memory: { context_window_used_pct: 45 },
      })

      const lines = renderEvent(event)
      const output = lines.join('\n')

      expect(output).toContain('MEMORY READ')
      expect(output).toContain('45%')
    })

    it('should render MEMORY_WRITE events', () => {
      const event = createTestEvent({
        schema_type: 'MEMORY_WRITE',
        memory: { context_window_used_pct: 52 },
      })

      const lines = renderEvent(event)
      const output = lines.join('\n')

      expect(output).toContain('MEMORY WRITE')
      expect(output).toContain('52%')
    })

    it('should render COST_CHECKPOINT events', () => {
      const event = createTestEvent({
        schema_type: 'COST_CHECKPOINT',
        metadata: { total_cost_usd: 0.0125 },
      })

      const lines = renderEvent(event)
      const output = lines.join('\n')

      expect(output).toContain('COST CHECKPOINT')
      expect(output).toContain('0.0125')
    })

    it('should include PII redaction indicator when detected', () => {
      const event = createTestEvent({
        privacy: {
          pii_detected: true,
          redacted_fields: ['email', 'api_key'],
        },
      })

      const lines = renderEvent(event)
      const output = lines.join('\n')

      expect(output).toContain('PII REDACTED')
      expect(output).toContain('email')
      expect(output).toContain('api_key')
    })

    it('should use correct emoji for each agent phase', () => {
      const phases = ['PLAN', 'TOOL_CALL', 'OBSERVE', 'REFLECT', 'RESPOND', 'IDLE']
      const phaseEmoji: Record<string, string> = {
        PLAN: '📋',
        TOOL_CALL: '🔧',
        OBSERVE: '👁',
        REFLECT: '💭',
        RESPOND: '💬',
        IDLE: '⏸',
      }

      for (const phase of phases) {
        const event = createTestEvent({
          agent: { name: 'TestAgent', phase: phase as any },
        })
        const lines = renderEvent(event)
        const output = lines.join('\n')
        expect(output).toContain(phaseEmoji[phase])
      }
    })

    it('should respect NO_COLOR environment variable', () => {
      process.env.NO_COLOR = '1'

      const event = createTestEvent({
        schema_type: 'TOOL_CALL',
        tool: {
          name: 'test_tool',
          input: {},
          output: 'result',
          status: 'SUCCESS',
          duration_ms: 100,
        },
      })

      const lines = renderEvent(event)
      const output = lines.join('\n')

      // Should not contain ANSI escape codes
      expect(output).not.toContain('\x1b[')
      expect(output).toContain('SUCCESS')
      expect(output).toContain('test_tool')
    })

    it('should respect CI environment variable', () => {
      process.env.CI = '1'

      const event = createTestEvent({
        schema_type: 'AGENT_START',
      })

      const lines = renderEvent(event)
      const output = lines.join('\n')

      // Should not contain ANSI escape codes
      expect(output).not.toContain('\x1b[')
      expect(output).toContain('AGENT START')
    })

    it('should handle undefined optional fields gracefully', () => {
      const event = createTestEvent({
        schema_type: 'TOOL_CALL',
        tool: {
          name: 'test_tool',
          input: {},
          output: undefined,
          status: 'SUCCESS',
          duration_ms: 100,
        },
      })

      const lines = renderEvent(event)
      expect(lines.length).toBeGreaterThan(0)
      expect(() => lines.join('\n')).not.toThrow()
    })

    it('should truncate long output strings', () => {
      const longOutput = 'a'.repeat(100)

      const event = createTestEvent({
        schema_type: 'TOOL_CALL',
        tool: {
          name: 'test_tool',
          input: {},
          output: longOutput,
          status: 'SUCCESS',
          duration_ms: 100,
        },
      })

      const lines = renderEvent(event)
      const output = lines.join('\n')

      expect(output).toContain('...')
    })
  })

  describe('renderSequence', () => {
    it('should render multiple events in order', () => {
      const events = [
        createTestEvent({
          schema_type: 'AGENT_START',
          step_index: 0,
        }),
        createTestEvent({
          schema_type: 'TOOL_CALL',
          step_index: 1,
          tool: {
            name: 'tool1',
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

      const output = renderSequence(events)

      expect(output).toContain('AGENT START')
      expect(output).toContain('TOOL CALL')
      expect(output).toContain('tool1')
      expect(output).toContain('AGENT END')

      // Check order is preserved
      const startIndex = output.indexOf('AGENT START')
      const toolIndex = output.indexOf('TOOL CALL')
      const endIndex = output.indexOf('AGENT END')

      expect(startIndex).toBeLessThan(toolIndex)
      expect(toolIndex).toBeLessThan(endIndex)
    })

    it('should handle empty event array', () => {
      const output = renderSequence([])
      expect(output).toBe('')
    })
  })
})
