import { describe, it, expect } from 'vitest'
import { ARLS_VERSION, type ARLSEvent } from '../src/schema.js'

describe('ARLS Schema', () => {
  it('should have correct ARLS_VERSION', () => {
    expect(ARLS_VERSION).toBe('1.0')
  })

  it('should allow creating a valid ARLSEvent with all required fields', () => {
    const event: ARLSEvent = {
      agentlens_version: ARLS_VERSION,
      schema_type: 'LLM_CALL',
      timestamp: new Date().toISOString(),
      trace_id: 'trace_abc123',
      run_id: 'run_123_abc',
      step_index: 0,
      agent: {
        name: 'TestAgent',
        phase: 'PLAN',
      },
      privacy: {
        pii_detected: false,
        redacted_fields: [],
      },
      semantic_tags: [],
    }

    expect(event.schema_type).toBe('LLM_CALL')
    expect(event.agent.name).toBe('TestAgent')
    expect(event.privacy.pii_detected).toBe(false)
  })

  it('should allow all SchemaType values', () => {
    const types: Array<ARLSEvent['schema_type']> = [
      'AGENT_START',
      'AGENT_END',
      'LLM_CALL',
      'TOOL_CALL',
      'MEMORY_READ',
      'MEMORY_WRITE',
      'REASONING_STEP',
      'ERROR',
      'COST_CHECKPOINT',
    ]

    expect(types).toHaveLength(9)
  })

  it('should allow all AgentPhase values', () => {
    const event: ARLSEvent = {
      agentlens_version: ARLS_VERSION,
      schema_type: 'AGENT_START',
      timestamp: new Date().toISOString(),
      trace_id: 'trace_abc',
      run_id: 'run_123',
      step_index: 0,
      agent: {
        name: 'Agent',
        phase: 'REFLECT',
      },
      privacy: {
        pii_detected: false,
        redacted_fields: [],
      },
      semantic_tags: [],
    }

    expect(['PLAN', 'TOOL_CALL', 'OBSERVE', 'REFLECT', 'RESPOND', 'IDLE']).toContain(event.agent.phase)
  })

  it('should support optional LLM call data', () => {
    const event: ARLSEvent = {
      agentlens_version: ARLS_VERSION,
      schema_type: 'LLM_CALL',
      timestamp: new Date().toISOString(),
      trace_id: 'trace_abc',
      run_id: 'run_123',
      step_index: 1,
      agent: {
        name: 'Agent',
        phase: 'RESPOND',
      },
      llm: {
        model: 'claude-3-sonnet',
        provider: 'anthropic',
        prompt_tokens: 100,
        completion_tokens: 50,
        total_tokens: 150,
        cost_usd: 0.001,
        latency_ms: 500,
        finish_reason: 'end_turn',
      },
      privacy: {
        pii_detected: false,
        redacted_fields: [],
      },
      semantic_tags: [],
    }

    expect(event.llm?.model).toBe('claude-3-sonnet')
    expect(event.llm?.total_tokens).toBe(150)
  })

  it('should support optional tool call data', () => {
    const event: ARLSEvent = {
      agentlens_version: ARLS_VERSION,
      schema_type: 'TOOL_CALL',
      timestamp: new Date().toISOString(),
      trace_id: 'trace_abc',
      run_id: 'run_123',
      step_index: 0,
      agent: {
        name: 'Agent',
        phase: 'TOOL_CALL',
      },
      tool: {
        name: 'search',
        input: { query: 'test' },
        output: { results: [] },
        status: 'SUCCESS',
        duration_ms: 1000,
      },
      privacy: {
        pii_detected: false,
        redacted_fields: [],
      },
      semantic_tags: [],
    }

    expect(event.tool?.name).toBe('search')
    expect(event.tool?.status).toBe('SUCCESS')
  })

  it('should support optional error data', () => {
    const event: ARLSEvent = {
      agentlens_version: ARLS_VERSION,
      schema_type: 'ERROR',
      timestamp: new Date().toISOString(),
      trace_id: 'trace_abc',
      run_id: 'run_123',
      step_index: 2,
      agent: {
        name: 'Agent',
        phase: 'IDLE',
      },
      error: {
        code: 'TOOL_FAILURE',
        message: 'Tool failed to execute',
        recoverable: true,
        recovery_hint: 'Retry with different parameters',
      },
      privacy: {
        pii_detected: false,
        redacted_fields: [],
      },
      semantic_tags: [],
    }

    expect(event.error?.code).toBe('TOOL_FAILURE')
    expect(event.error?.recoverable).toBe(true)
  })
})
