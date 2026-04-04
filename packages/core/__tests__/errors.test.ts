import { describe, it, expect } from 'vitest'
import {
  AgentLensError,
  SchemaValidationError,
  TransportError,
  ContextError,
  InterceptorError,
} from '../src/errors.js'

describe('Error Classes', () => {
  it('should create AgentLensError with required fields', () => {
    const error = new AgentLensError('Test message', 'TEST_CODE', true)

    expect(error.message).toBe('Test message')
    expect(error.code).toBe('TEST_CODE')
    expect(error.recoverable).toBe(true)
    expect(error.name).toBe('AgentLensError')
  })

  it('should default recoverable to true', () => {
    const error = new AgentLensError('Test', 'TEST')

    expect(error.recoverable).toBe(true)
  })

  it('should be an instance of Error', () => {
    const error = new AgentLensError('Test', 'TEST')

    expect(error).toBeInstanceOf(Error)
    expect(error).toBeInstanceOf(AgentLensError)
  })

  it('should create SchemaValidationError', () => {
    const error = new SchemaValidationError('Invalid schema', false)

    expect(error.code).toBe('SCHEMA_VALIDATION_ERROR')
    expect(error.recoverable).toBe(false)
    expect(error.name).toBe('SchemaValidationError')
    expect(error).toBeInstanceOf(AgentLensError)
  })

  it('should create TransportError', () => {
    const error = new TransportError('Transport failed')

    expect(error.code).toBe('TRANSPORT_ERROR')
    expect(error.recoverable).toBe(true)
    expect(error.name).toBe('TransportError')
    expect(error).toBeInstanceOf(AgentLensError)
  })

  it('should create ContextError', () => {
    const error = new ContextError('Context missing')

    expect(error.code).toBe('CONTEXT_ERROR')
    expect(error.recoverable).toBe(true)
    expect(error.name).toBe('ContextError')
    expect(error).toBeInstanceOf(AgentLensError)
  })

  it('should create InterceptorError', () => {
    const error = new InterceptorError('Interceptor failed')

    expect(error.code).toBe('INTERCEPTOR_ERROR')
    expect(error.recoverable).toBe(true)
    expect(error.name).toBe('InterceptorError')
    expect(error).toBeInstanceOf(AgentLensError)
  })

  it('should be throwable and catchable', () => {
    expect(() => {
      throw new AgentLensError('Test', 'TEST')
    }).toThrow(AgentLensError)
  })

  it('should preserve stack trace', () => {
    const error = new AgentLensError('Test', 'TEST')

    expect(error.stack).toBeDefined()
    expect(error.stack).toContain('AgentLensError')
  })

  it('should support error subclass instanceof checks', () => {
    const schemaError = new SchemaValidationError('Invalid')
    const transportError = new TransportError('Failed')

    expect(schemaError).toBeInstanceOf(SchemaValidationError)
    expect(schemaError).toBeInstanceOf(AgentLensError)
    expect(transportError).toBeInstanceOf(TransportError)
    expect(transportError).toBeInstanceOf(AgentLensError)
  })

  it('should allow custom codes', () => {
    const error = new AgentLensError('Message', 'MY_CUSTOM_CODE')

    expect(error.code).toBe('MY_CUSTOM_CODE')
  })

  it('should allow custom recoverable values', () => {
    const recoverable = new AgentLensError('Message', 'CODE', true)
    const unrecoverable = new AgentLensError('Message', 'CODE', false)

    expect(recoverable.recoverable).toBe(true)
    expect(unrecoverable.recoverable).toBe(false)
  })
})
