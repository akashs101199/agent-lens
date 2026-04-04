/**
 * @agentlens/core — Core AgentLens library
 * Exports the ARLS schema, context management, event builders, and error classes.
 */

export {
  ARLS_VERSION,
  type SchemaType,
  type AgentPhase,
  type RedactionMode,
  type CallStatus,
  type LLMProvider,
  type AgentContext,
  type LLMCallData,
  type ToolCallData,
  type MemoryData,
  type PrivacyData,
  type ErrorData,
  type ARLSEvent,
} from './schema.js'

export {
  type RunContext,
  createRunContext,
  getRunContext,
  runInContext,
  incrementStep,
} from './context.js'

export {
  type LLMCallInput,
  type ToolCallInput,
  type AgentEndSummary,
  buildLLMEvent,
  buildToolEvent,
  buildAgentStartEvent,
  buildAgentEndEvent,
  buildErrorEvent,
} from './event-builder.js'

export {
  AgentLensError,
  SchemaValidationError,
  TransportError,
  ContextError,
  InterceptorError,
} from './errors.js'
