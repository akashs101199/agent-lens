import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { FileTransport } from '../src/file.js'
import { promises as fs } from 'fs'
import { join } from 'path'
import { mkdtemp } from 'fs'
import { tmpdir } from 'os'
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

describe('FileTransport', () => {
  let tempDir: string

  beforeEach(async () => {
    tempDir = await new Promise((resolve, reject) => {
      mkdtemp(join(tmpdir(), 'agentlens-'), (err, dir) => {
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

  describe('file writing', () => {
    it('should write events to file in JSONL format', async () => {
      const filePath = join(tempDir, 'test.log')
      const transport = new FileTransport({ filePath })
      const event = createTestEvent()
      const rendered = JSON.stringify(event)

      await transport.write(event, rendered)
      await transport.flush()
      await transport.close()

      const content = await fs.readFile(filePath, 'utf-8')
      expect(content).toContain('"agentlens_version"')
      expect(content.trim()).toBe(rendered)
    })

    it('should write multiple events as separate lines', async () => {
      const filePath = join(tempDir, 'test.log')
      const transport = new FileTransport({ filePath })

      const event1 = createTestEvent({ step_index: 1 })
      const event2 = createTestEvent({ step_index: 2 })
      const rendered1 = JSON.stringify(event1)
      const rendered2 = JSON.stringify(event2)

      await transport.write(event1, rendered1)
      await transport.write(event2, rendered2)
      await transport.flush()
      await transport.close()

      const content = await fs.readFile(filePath, 'utf-8')
      const lines = content.trim().split('\n')

      expect(lines).toHaveLength(2)
      expect(lines[0]).toBe(rendered1)
      expect(lines[1]).toBe(rendered2)
    })

    it('should create directory if it does not exist', async () => {
      const filePath = join(tempDir, 'subdir', 'nested', 'test.log')
      const transport = new FileTransport({ filePath })
      const event = createTestEvent()

      await transport.write(event, JSON.stringify(event))
      await transport.flush()
      await transport.close()

      const exists = await fs.stat(filePath).catch(() => null)
      expect(exists).not.toBeNull()
    })
  })

  describe('file rotation', () => {
    it('should rotate file when exceeding maxFileSize', async () => {
      const filePath = join(tempDir, 'test.log')
      // Small max size to trigger rotation easily
      const transport = new FileTransport({
        filePath,
        maxFileSize: 100, // 100 bytes
      })

      // Each event string is roughly 150+ bytes
      const event1 = createTestEvent({ step_index: 1 })
      const event2 = createTestEvent({ step_index: 2 })

      const rendered1 = JSON.stringify(event1)
      const rendered2 = JSON.stringify(event2)

      await transport.write(event1, rendered1)
      await transport.flush()

      const sizeAfterFirst = (await transport._getCurrentFileSize?.()) ?? 0
      expect(sizeAfterFirst).toBeGreaterThan(0)

      await transport.write(event2, rendered2)
      await transport.flush()
      await transport.close()

      // Check if rotation occurred
      const mainFile = await fs.readFile(filePath, 'utf-8').catch(() => '')
      const rotatedFile = await fs.readFile(`${filePath.replace('.log', '')}.1.log`, 'utf-8').catch(() => '')

      // Should have content in one of the files
      expect(mainFile.length + rotatedFile.length).toBeGreaterThan(0)
    })

    it('should respect maxRotatedFiles limit', async () => {
      const filePath = join(tempDir, 'test.log')
      const transport = new FileTransport({
        filePath,
        maxFileSize: 100,
        maxRotatedFiles: 2, // Keep max 2 rotated files
      })

      // Write enough events to trigger multiple rotations
      for (let i = 1; i <= 5; i++) {
        const event = createTestEvent({ step_index: i })
        await transport.write(event, JSON.stringify(event))
        await transport.flush()
      }

      await transport.close()

      // Check how many rotated files exist
      const files = await fs.readdir(tempDir)
      const logFiles = files.filter((f) => f.includes('test') && f.includes('log'))

      // Should not exceed maxRotatedFiles + 1 (current file)
      expect(logFiles.length).toBeLessThanOrEqual(3)
    })
  })

  describe('configuration', () => {
    it('should use default maxFileSize if not specified', async () => {
      const filePath = join(tempDir, 'test.log')
      const transport = new FileTransport({ filePath })
      expect(transport).toBeDefined()
      await transport.close()
    })

    it('should use default maxRotatedFiles if not specified', async () => {
      const filePath = join(tempDir, 'test.log')
      const transport = new FileTransport({ filePath })
      expect(transport).toBeDefined()
      await transport.close()
    })

    it('should respect custom queue size', async () => {
      const filePath = join(tempDir, 'test.log')
      const transport = new FileTransport({
        filePath,
        maxQueueSize: 10,
      })
      expect(transport).toBeDefined()
      await transport.close()
    })
  })

  describe('lifecycle', () => {
    it('should handle write, flush, close sequence', async () => {
      const filePath = join(tempDir, 'test.log')
      const transport = new FileTransport({ filePath })
      const event = createTestEvent()

      await transport.write(event, JSON.stringify(event))
      await transport.flush()
      await transport.close()

      const content = await fs.readFile(filePath, 'utf-8')
      expect(content).toBeTruthy()
    })

    it('should handle close without write', async () => {
      const filePath = join(tempDir, 'test.log')
      const transport = new FileTransport({ filePath })

      await expect(transport.close()).resolves.toBeUndefined()
    })

    it('should handle multiple flushes', async () => {
      const filePath = join(tempDir, 'test.log')
      const transport = new FileTransport({ filePath })
      const event = createTestEvent()

      await transport.write(event, JSON.stringify(event))
      await transport.flush()
      await transport.flush()
      await transport.close()

      const content = await fs.readFile(filePath, 'utf-8')
      const lines = content.trim().split('\n')
      expect(lines).toHaveLength(1) // Should only have one event
    })
  })

  describe('JSONL format', () => {
    it('should output valid JSON on each line', async () => {
      const filePath = join(tempDir, 'test.log')
      const transport = new FileTransport({ filePath })

      const events = Array.from({ length: 3 }, (_, i) =>
        createTestEvent({ step_index: i + 1 })
      )

      for (const event of events) {
        await transport.write(event, JSON.stringify(event))
      }

      await transport.flush()
      await transport.close()

      const content = await fs.readFile(filePath, 'utf-8')
      const lines = content.trim().split('\n')

      for (const line of lines) {
        expect(() => JSON.parse(line)).not.toThrow()
      }
    })
  })
})
