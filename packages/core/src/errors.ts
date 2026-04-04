/**
 * Base error class for all AgentLens errors.
 * Never throw a plain Error — always throw a specific AgentLensError subclass.
 */
export class AgentLensError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly recoverable: boolean = true,
  ) {
    super(message)
    this.name = 'AgentLensError'
    Object.setPrototypeOf(this, AgentLensError.prototype)
  }
}

/**
 * Thrown when an ARLSEvent fails schema validation.
 */
export class SchemaValidationError extends AgentLensError {
  constructor(message: string, recoverable: boolean = false) {
    super(message, 'SCHEMA_VALIDATION_ERROR', recoverable)
    this.name = 'SchemaValidationError'
    Object.setPrototypeOf(this, SchemaValidationError.prototype)
  }
}

/**
 * Thrown when a transport encounters an error writing events.
 */
export class TransportError extends AgentLensError {
  constructor(message: string, recoverable: boolean = true) {
    super(message, 'TRANSPORT_ERROR', recoverable)
    this.name = 'TransportError'
    Object.setPrototypeOf(this, TransportError.prototype)
  }
}

/**
 * Thrown when run context is missing or invalid.
 */
export class ContextError extends AgentLensError {
  constructor(message: string, recoverable: boolean = true) {
    super(message, 'CONTEXT_ERROR', recoverable)
    this.name = 'ContextError'
    Object.setPrototypeOf(this, ContextError.prototype)
  }
}

/**
 * Thrown when an interceptor fails to wrap a function or SDK client.
 */
export class InterceptorError extends AgentLensError {
  constructor(message: string, recoverable: boolean = true) {
    super(message, 'INTERCEPTOR_ERROR', recoverable)
    this.name = 'InterceptorError'
    Object.setPrototypeOf(this, InterceptorError.prototype)
  }
}
