import { describe, it, expect } from 'vitest'
import {
  createRunContext,
  getRunContext,
  runInContext,
  incrementStep,
  type RunContext,
} from '../src/context.js'

describe('Context Management', () => {
  it('should create a run context with unique IDs', () => {
    const ctx = createRunContext('TestAgent')

    expect(ctx.run_id).toMatch(/^run_\d+_[0-9a-f]{6}$/)
    expect(ctx.trace_id).toMatch(/^trace_[0-9a-f]{12}$/)
    expect(ctx.step_index).toBe(0)
  })

  it('should generate different IDs on each call', () => {
    const ctx1 = createRunContext('Agent1')
    const ctx2 = createRunContext('Agent2')

    expect(ctx1.run_id).not.toBe(ctx2.run_id)
    expect(ctx1.trace_id).not.toBe(ctx2.trace_id)
  })

  it('should return undefined when no context is active', () => {
    const ctx = getRunContext()
    expect(ctx).toBeUndefined()
  })

  it('should make context accessible inside runInContext', async () => {
    const testCtx = createRunContext('TestAgent')

    await runInContext(testCtx, async () => {
      const ctx = getRunContext()
      expect(ctx).not.toBeUndefined()
      expect(ctx?.run_id).toBe(testCtx.run_id)
      expect(ctx?.trace_id).toBe(testCtx.trace_id)
    })
  })

  it('should make context inaccessible outside runInContext', async () => {
    const testCtx = createRunContext('TestAgent')

    await runInContext(testCtx, async () => {
      // Inside context
      expect(getRunContext()).not.toBeUndefined()
    })

    // Outside context
    expect(getRunContext()).toBeUndefined()
  })

  it('should increment step_index', async () => {
    const testCtx = createRunContext('TestAgent')

    await runInContext(testCtx, async () => {
      expect(getRunContext()?.step_index).toBe(0)
      incrementStep()
      expect(getRunContext()?.step_index).toBe(1)
      incrementStep()
      expect(getRunContext()?.step_index).toBe(2)
    })
  })

  it('should isolate contexts between concurrent runs', async () => {
    const ctx1 = createRunContext('Agent1')
    const ctx2 = createRunContext('Agent2')

    const promise1 = runInContext(ctx1, async () => {
      expect(getRunContext()?.run_id).toBe(ctx1.run_id)
      incrementStep()
      expect(getRunContext()?.step_index).toBe(1)
      await new Promise((resolve) => setTimeout(resolve, 10))
      // ctx1 should still have step_index 1, not affected by ctx2
      expect(getRunContext()?.step_index).toBe(1)
    })

    const promise2 = runInContext(ctx2, async () => {
      expect(getRunContext()?.run_id).toBe(ctx2.run_id)
      incrementStep()
      incrementStep()
      expect(getRunContext()?.step_index).toBe(2)
    })

    await Promise.all([promise1, promise2])
  })

  it('incrementStep should do nothing outside context', () => {
    expect(getRunContext()).toBeUndefined()
    expect(() => incrementStep()).not.toThrow()
  })

  it('should support nested async operations', async () => {
    const ctx = createRunContext('TestAgent')

    await runInContext(ctx, async () => {
      expect(getRunContext()?.run_id).toBe(ctx.run_id)
      incrementStep()

      const nestedPromise = Promise.resolve()
        .then(() => {
          expect(getRunContext()?.run_id).toBe(ctx.run_id)
          incrementStep()
          expect(getRunContext()?.step_index).toBe(2)
        })

      await nestedPromise
      expect(getRunContext()?.step_index).toBe(2)
    })
  })
})
