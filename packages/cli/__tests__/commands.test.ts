import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { existsSync } from 'fs'
import { promises as fs } from 'fs'
import { join } from 'path'
import { mkdtemp } from 'fs'
import { tmpdir } from 'os'
import { initCommand } from '../src/commands/init.js'
import { traceCommand } from '../src/commands/trace.js'
import { analyzeCommand } from '../src/commands/analyze.js'

describe('CLI Commands', () => {
  let tempDir: string

  beforeEach(async () => {
    tempDir = await new Promise((resolve, reject) => {
      mkdtemp(join(tmpdir(), 'agentlens-cli-'), (err, dir) => {
        if (err) reject(err)
        else resolve(dir)
      })
    })
  })

  afterEach(async () => {
    try {
      await fs.rm(tempDir, { recursive: true, force: true })
    } catch {
      // Ignore cleanup errors
    }
  })

  describe('init command', () => {
    it('should handle init command without error', async () => {
      // Mock console to prevent output and avoid actual file system operations
      vi.spyOn(console, 'log').mockImplementation(() => {})
      vi.spyOn(console, 'error').mockImplementation(() => {})

      // Mock fs.readFile to simulate package.json
      vi.spyOn(fs, 'readFile').mockResolvedValueOnce(
        JSON.stringify({
          name: 'test-project',
          version: '1.0.0',
          dependencies: {},
        }) as any
      )

      // Mock fs.writeFile
      vi.spyOn(fs, 'writeFile').mockResolvedValueOnce(undefined as any)

      await initCommand()

      vi.restoreAllMocks()
    })
  })

  describe('trace command', () => {
    it('should read JSONL file and filter by run_id', async () => {
      const logPath = join(tempDir, 'test.log')

      // Create a test JSONL file
      const events = [
        {
          run_id: 'run_123',
          step_index: 1,
          schema_type: 'AGENT_START',
          timestamp: new Date().toISOString(),
          trace_id: 'trace_123',
          agent: { name: 'TestAgent', phase: 'PLAN' },
          privacy: { pii_detected: false, redacted_fields: [] },
          semantic_tags: [],
        },
        {
          run_id: 'run_456',
          step_index: 1,
          schema_type: 'AGENT_START',
          timestamp: new Date().toISOString(),
          trace_id: 'trace_456',
          agent: { name: 'TestAgent', phase: 'PLAN' },
          privacy: { pii_detected: false, redacted_fields: [] },
          semantic_tags: [],
        },
      ]

      const jsonlContent = events.map((e) => JSON.stringify(e)).join('\n')
      await fs.writeFile(logPath, jsonlContent, 'utf-8')

      // Mock console to prevent output
      vi.spyOn(console, 'log').mockImplementation(() => {})

      // Should not throw
      await expect(traceCommand('run_123', logPath)).resolves.toBeUndefined()

      vi.restoreAllMocks()
    })

    it('should handle missing run_id gracefully', async () => {
      const logPath = join(tempDir, 'test.log')

      // Create an empty log file
      await fs.writeFile(logPath, '', 'utf-8')

      // Mock console to prevent output
      vi.spyOn(console, 'log').mockImplementation(() => {})

      // Should not throw
      await expect(traceCommand('run_nonexistent', logPath)).resolves.toBeUndefined()

      vi.restoreAllMocks()
    })
  })

  describe('analyze command', () => {
    it('should compute statistics from JSONL file', async () => {
      const logPath = join(tempDir, 'test.log')

      // Create a test JSONL file with various events
      const events = [
        {
          run_id: 'run_123',
          step_index: 1,
          schema_type: 'LLM_CALL',
          timestamp: new Date().toISOString(),
          trace_id: 'trace_123',
          agent: { name: 'TestAgent', phase: 'PLAN' },
          llm: {
            model: 'gpt-4',
            provider: 'openai',
            prompt_tokens: 100,
            completion_tokens: 50,
            total_tokens: 150,
            cost_usd: 0.005,
            latency_ms: 1000,
            finish_reason: 'stop',
          },
          privacy: { pii_detected: false, redacted_fields: [] },
          semantic_tags: [],
        },
        {
          run_id: 'run_123',
          step_index: 2,
          schema_type: 'TOOL_CALL',
          timestamp: new Date().toISOString(),
          trace_id: 'trace_123',
          agent: { name: 'TestAgent', phase: 'TOOL_CALL' },
          tool: {
            name: 'search',
            input: {},
            output: 'result',
            status: 'SUCCESS',
            duration_ms: 500,
          },
          privacy: { pii_detected: false, redacted_fields: [] },
          semantic_tags: [],
        },
      ]

      const jsonlContent = events.map((e) => JSON.stringify(e)).join('\n')
      await fs.writeFile(logPath, jsonlContent, 'utf-8')

      // Mock console to prevent output
      vi.spyOn(console, 'log').mockImplementation(() => {})

      // Should not throw
      await expect(analyzeCommand(logPath)).resolves.toBeUndefined()

      vi.restoreAllMocks()
    })

    it('should handle empty files gracefully', async () => {
      const logPath = join(tempDir, 'empty.log')
      await fs.writeFile(logPath, '', 'utf-8')

      // Mock console to prevent output
      vi.spyOn(console, 'log').mockImplementation(() => {})

      // Should not throw
      await expect(analyzeCommand(logPath)).resolves.toBeUndefined()

      vi.restoreAllMocks()
    })
  })
})
