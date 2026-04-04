# CLAUDE.md — AgentLens Build Instructions

> This file tells Claude Code exactly how to build AgentLens phase by phase.  
> Read this entire file before writing any code. Follow the phases strictly in order.  
> Do not move to the next phase until the current phase passes all tests and compiles cleanly.

---

## Project Identity

**Name:** AgentLens  
**Type:** Open source TypeScript library (npm)  
**Purpose:** AI agent observability — structured logging for LLM calls, tool calls, and reasoning steps  
**Core innovation:** The AI-Readable Log Schema (ARLS) — a versioned JSON standard readable by both humans and AI dev tools  
**License:** MIT  

---

## Non-Negotiable Rules

These rules apply to every line of code written in this project. Never violate them.

1. **TypeScript strict mode always.** Every file must pass `tsc --strict` with zero errors.
2. **Zero required runtime dependencies in `packages/core`.** The core package must have no `dependencies` in its `package.json`. Dev dependencies only.
3. **Every public API must have JSDoc.** Every exported function, class, type, and constant needs a JSDoc comment.
4. **Tests before shipping.** Every feature must have a corresponding test in `__tests__/` before it is considered done.
5. **No `any` type.** Use `unknown` and narrow it. Never use `as any`.
6. **Errors are typed.** Never `throw new Error(string)` from a public API. Define error classes.
7. **ARLS schema is the source of truth.** Every log event must conform to the schema defined in `packages/core/src/schema.ts`. Never log outside the schema.
8. **Async is non-blocking.** Transport writes must never block the calling code. Use async queues.
9. **Privacy first.** PII redaction runs before any event reaches a transport. No exceptions.
10. **Human output is beautiful.** The terminal renderer must produce output a developer is proud to look at.

---

## Repository Structure

Create this exact structure. Do not deviate.

```
agentlens/
├── packages/
│   ├── core/
│   │   ├── src/
│   │   │   ├── schema.ts          # ARLS schema types — the single source of truth
│   │   │   ├── context.ts         # run_id / trace_id / step_index propagation
│   │   │   ├── event-builder.ts   # Builds typed ARLS events from raw inputs
│   │   │   ├── errors.ts          # Typed error classes
│   │   │   └── index.ts           # Public exports
│   │   ├── __tests__/
│   │   ├── package.json
│   │   └── tsconfig.json
│   ├── interceptors/
│   │   ├── src/
│   │   │   ├── anthropic.ts       # Wraps @anthropic-ai/sdk
│   │   │   ├── openai.ts          # Wraps openai sdk
│   │   │   ├── tool.ts            # Wraps any async function as a tool
│   │   │   └── index.ts
│   │   ├── __tests__/
│   │   ├── package.json
│   │   └── tsconfig.json
│   ├── privacy/
│   │   ├── src/
│   │   │   ├── detectors.ts       # PII pattern matchers
│   │   │   ├── redactor.ts        # Applies redaction to log events
│   │   │   └── index.ts
│   │   ├── __tests__/
│   │   ├── package.json
│   │   └── tsconfig.json
│   ├── renderer/
│   │   ├── src/
│   │   │   ├── human.ts           # Colored terminal output
│   │   │   ├── ai.ts              # ARLS JSON output for Claude Code / Copilot
│   │   │   └── index.ts
│   │   ├── __tests__/
│   │   ├── package.json
│   │   └── tsconfig.json
│   ├── transport/
│   │   ├── src/
│   │   │   ├── base.ts            # Abstract transport class
│   │   │   ├── console.ts         # Writes to stdout
│   │   │   ├── file.ts            # Writes to JSONL file
│   │   │   └── index.ts
│   │   ├── __tests__/
│   │   ├── package.json
│   │   └── tsconfig.json
│   └── cli/
│       ├── src/
│       │   ├── commands/
│       │   │   ├── init.ts        # npx agentlens init
│       │   │   ├── trace.ts       # npx agentlens trace <run_id>
│       │   │   └── analyze.ts     # npx agentlens analyze <file>
│       │   └── index.ts           # CLI entry point
│       ├── __tests__/
│       ├── package.json
│       └── tsconfig.json
├── examples/
│   ├── anthropic-basic/           # Simple Anthropic SDK example
│   ├── openai-basic/              # Simple OpenAI SDK example
│   └── tool-calling/              # Multi-tool agent example
├── docs/
│   └── ARLS_SPEC.md               # Open schema specification
├── AGENTLENS_PRD.md               # Full product requirements
├── CLAUDE.md                      # This file
├── package.json                   # Root workspace package.json
├── tsconfig.base.json             # Shared TypeScript config
├── .eslintrc.json
├── .gitignore
├── LICENSE
└── README.md
```

---

## Phase 1 — Core Package

**Complete this entire phase before writing any other code.**

### Step 1.1 — Monorepo Setup

Create the root `package.json` as a pnpm workspace:

```json
{
  "name": "agentlens",
  "private": true,
  "workspaces": ["packages/*"],
  "scripts": {
    "build": "pnpm -r build",
    "test": "pnpm -r test",
    "lint": "eslint packages/*/src/**/*.ts",
    "typecheck": "pnpm -r typecheck"
  },
  "devDependencies": {
    "typescript": "^5.4.0",
    "vitest": "^1.6.0",
    "@types/node": "^20.0.0",
    "eslint": "^8.57.0",
    "@typescript-eslint/parser": "^7.0.0",
    "@typescript-eslint/eslint-plugin": "^7.0.0"
  }
}
```

Create `tsconfig.base.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "esModuleInterop": true,
    "skipLibCheck": true
  }
}
```

### Step 1.2 — ARLS Schema Types

This is the most important file in the entire project. Get it right before touching anything else.

Create `packages/core/src/schema.ts` with these exact types:

```typescript
/** ARLS schema version — bump minor for additions, major for breaking changes */
export const ARLS_VERSION = '1.0' as const

/** All possible schema_type values for a log event */
export type SchemaType =
  | 'AGENT_START'
  | 'AGENT_END'
  | 'LLM_CALL'
  | 'TOOL_CALL'
  | 'MEMORY_READ'
  | 'MEMORY_WRITE'
  | 'REASONING_STEP'
  | 'ERROR'
  | 'COST_CHECKPOINT'

/** Agent execution phase at the time of the event */
export type AgentPhase = 'PLAN' | 'TOOL_CALL' | 'OBSERVE' | 'REFLECT' | 'RESPOND' | 'IDLE'

/** PII redaction mode */
export type RedactionMode = 'MASK' | 'HASH' | 'DROP' | 'PLACEHOLDER'

/** Tool call / LLM call completion status */
export type CallStatus = 'SUCCESS' | 'FAILURE' | 'TIMEOUT' | 'CANCELLED'

/** LLM provider identifier */
export type LLMProvider = 'anthropic' | 'openai' | 'google' | 'cohere' | 'litellm' | string

/** Agent context embedded in every event */
export interface AgentContext {
  name: string
  phase: AgentPhase
  parent_decision?: string
}

/** LLM call data — present when schema_type is LLM_CALL */
export interface LLMCallData {
  model: string
  provider: LLMProvider
  prompt_tokens: number
  completion_tokens: number
  total_tokens: number
  cost_usd: number
  latency_ms: number
  finish_reason: string
  time_to_first_token_ms?: number
}

/** Tool call data — present when schema_type is TOOL_CALL */
export interface ToolCallData {
  name: string
  input: Record<string, unknown>
  output: unknown
  status: CallStatus
  duration_ms: number
  error_message?: string
}

/** Memory operation data */
export interface MemoryData {
  context_window_used_pct?: number
  vector_db_reads?: number
  cache_hit?: boolean
  operation?: 'READ' | 'WRITE' | 'INJECT'
  similarity_score?: number
}

/** Privacy metadata */
export interface PrivacyData {
  pii_detected: boolean
  redacted_fields: string[]
  redaction_mode?: RedactionMode
}

/** Error data — present when schema_type is ERROR */
export interface ErrorData {
  code: string
  message: string
  stack?: string
  recoverable: boolean
  recovery_hint?: string
}

/**
 * A single ARLS-compliant log event.
 * This is the canonical shape of every event AgentLens produces.
 */
export interface ARLSEvent {
  agentlens_version: typeof ARLS_VERSION
  schema_type: SchemaType
  timestamp: string                  // ISO 8601
  trace_id: string
  run_id: string
  step_index: number
  agent: AgentContext
  llm?: LLMCallData
  tool?: ToolCallData
  memory?: MemoryData
  privacy: PrivacyData
  semantic_tags: string[]
  error?: ErrorData
  ai_debug_hint?: string
  metadata?: Record<string, unknown>
}
```

Write tests in `packages/core/__tests__/schema.test.ts` that verify:
- An `ARLSEvent` object with all required fields passes TypeScript compilation
- `ARLS_VERSION` is `'1.0'`
- All `SchemaType` values are the correct string literals

### Step 1.3 — Context Propagation

Create `packages/core/src/context.ts`.

This module manages the current run context using Node.js `AsyncLocalStorage` so `run_id`, `trace_id`, and `step_index` propagate automatically through async call chains without being passed as arguments.

Requirements:
- `createRunContext(agentName: string): RunContext` — generates a new `run_id` and `trace_id` using `crypto.randomUUID()`
- `getRunContext(): RunContext | undefined` — returns current context or undefined if called outside a run
- `runInContext<T>(ctx: RunContext, fn: () => Promise<T>): Promise<T>` — runs a function with the given context active
- `incrementStep(): void` — increments `step_index` on the current context
- Run IDs format: `run_${Date.now()}_${randomHex(6)}`
- Trace IDs format: `trace_${randomHex(12)}`

Write tests that verify:
- Context is accessible inside `runInContext`
- Context is `undefined` outside `runInContext`
- `incrementStep` increments only within the correct async context
- Two concurrent runs have independent step counters

### Step 1.4 — Event Builder

Create `packages/core/src/event-builder.ts`.

This module provides factory functions that construct valid `ARLSEvent` objects. It should never produce an event with missing required fields.

Requirements:
- `buildLLMEvent(data: LLMCallInput): ARLSEvent`
- `buildToolEvent(data: ToolCallInput): ARLSEvent`
- `buildAgentStartEvent(name: string): ARLSEvent`
- `buildAgentEndEvent(summary: AgentEndSummary): ARLSEvent`
- `buildErrorEvent(error: unknown, context?: string): ARLSEvent`
- Each builder reads the current context from `context.ts` — if no context exists, it generates a temporary one and logs a warning
- `ai_debug_hint` is auto-generated for common error patterns (CONTEXT_OVERFLOW, TOOL_FAILURE, LOOP_DETECTED)

Write tests that verify:
- Every builder produces a valid `ARLSEvent` conforming to the schema
- `timestamp` is a valid ISO 8601 string
- `run_id` and `trace_id` are present in every event
- `ai_debug_hint` is generated for `TOOL_FAILURE` errors

### Step 1.5 — Typed Errors

Create `packages/core/src/errors.ts` with these error classes:

```typescript
export class AgentLensError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly recoverable: boolean = true
  ) {
    super(message)
    this.name = 'AgentLensError'
  }
}

export class SchemaValidationError extends AgentLensError { ... }
export class TransportError extends AgentLensError { ... }
export class ContextError extends AgentLensError { ... }
export class InterceptorError extends AgentLensError { ... }
```

### Step 1.6 — Core Package Exports

Create `packages/core/src/index.ts` that re-exports everything from `schema.ts`, `context.ts`, `event-builder.ts`, and `errors.ts`.

**Phase 1 is complete when:**
- `pnpm --filter core build` succeeds with zero TypeScript errors
- `pnpm --filter core test` passes all tests
- `packages/core/src/index.ts` exports the full public API

---

## Phase 2 — Interceptors

**Start this phase only after Phase 1 tests pass.**

### Step 2.1 — Tool Interceptor

Create `packages/interceptors/src/tool.ts`.

This is the simplest interceptor and must be built first to validate the pattern.

```typescript
/**
 * Wraps any async function as an AgentLens-traced tool.
 * Input, output, duration, and status are automatically logged.
 */
export function wrapTool<TInput extends unknown[], TOutput>(
  name: string,
  fn: (...args: TInput) => Promise<TOutput>,
  options?: WrapToolOptions
): (...args: TInput) => Promise<TOutput>
```

Requirements:
- Captures start time before calling `fn`
- Captures end time after `fn` resolves or rejects
- On success: builds a `TOOL_CALL` event with status `SUCCESS`
- On failure: builds a `TOOL_CALL` event with status `FAILURE` and re-throws the original error
- Never swallows errors — AgentLens must be transparent to the caller
- `WrapToolOptions` allows overriding semantic tags and metadata

Write tests that verify:
- Return value is preserved exactly
- Errors are re-thrown unchanged
- A `TOOL_CALL` event is emitted with correct `duration_ms`
- Works with tools that return different output shapes

### Step 2.2 — Anthropic SDK Interceptor

Create `packages/interceptors/src/anthropic.ts`.

This interceptor wraps an `Anthropic` client instance and proxies `messages.create` calls.

```typescript
import type Anthropic from '@anthropic-ai/sdk'

/**
 * Wraps an Anthropic client so all messages.create calls are automatically
 * logged as ARLS LLM_CALL events.
 * 
 * @example
 * const client = wrapAnthropic(new Anthropic())
 * // All calls through client are now logged
 */
export function wrapAnthropic(client: Anthropic, options?: InterceptorOptions): Anthropic
```

Requirements:
- Returns a `Proxy` of the original client — all non-messages-create calls pass through unchanged
- For `messages.create` calls: capture start time, call original, capture response
- Extract token usage from the response: `usage.input_tokens`, `usage.output_tokens`
- Calculate `cost_usd` using a cost table for known models (define the table in `packages/core/src/costs.ts`)
- Handle streaming responses: accumulate chunks and log on stream end
- `@anthropic-ai/sdk` must be a `peerDependency`, not a `dependency`

Cost table for `packages/core/src/costs.ts` (per 1M tokens, USD):

```
claude-opus-4-*        input: $15.00   output: $75.00
claude-sonnet-4-*      input: $3.00    output: $15.00
claude-haiku-4-*       input: $0.80    output: $4.00
claude-haiku-3-*       input: $0.25    output: $1.25
```

Write tests using a mocked Anthropic client that verify:
- `LLM_CALL` event is emitted with correct model name and token counts
- Estimated cost is calculated correctly
- The original response is returned unchanged
- Errors from the Anthropic API are re-thrown and logged as ERROR events

### Step 2.3 — OpenAI SDK Interceptor

Create `packages/interceptors/src/openai.ts`.

Same pattern as the Anthropic interceptor.

```typescript
import type OpenAI from 'openai'

export function wrapOpenAI(client: OpenAI, options?: InterceptorOptions): OpenAI
```

Cost table (per 1M tokens, USD):

```
gpt-4o             input: $2.50    output: $10.00
gpt-4o-mini        input: $0.15    output: $0.60
gpt-4-turbo        input: $10.00   output: $30.00
o1                 input: $15.00   output: $60.00
o1-mini            input: $3.00    output: $12.00
```

**Phase 2 is complete when:**
- `pnpm --filter interceptors build` succeeds
- All interceptor tests pass
- The tool interceptor and both LLM interceptors are exported from `packages/interceptors/src/index.ts`

---

## Phase 3 — Privacy Engine

**Start this phase only after Phase 2 tests pass.**

### Step 3.1 — PII Detectors

Create `packages/privacy/src/detectors.ts`.

Implement these detectors as pure functions that return the matched string and its position:

| Detector Name | Pattern Description |
|---|---|
| `email` | Standard email format |
| `api_key` | Strings starting with `sk-`, `ak-`, `pk-`, `Bearer ` |
| `credit_card` | 13-19 digit sequences matching Luhn algorithm |
| `phone_us` | US phone number formats |
| `ssn` | SSN format `XXX-XX-XXXX` |
| `password` | JSON fields named `password`, `passwd`, `secret`, `token` |

Each detector:
- Is a pure function: `(input: string) => DetectionResult[]`
- Returns an array of `{ value: string, start: number, end: number, type: string }`
- Never throws — returns empty array on any internal error

### Step 3.2 — Redactor

Create `packages/privacy/src/redactor.ts`.

```typescript
/**
 * Applies PII redaction to a string value before it is logged.
 * Runs all configured detectors and replaces matches per the redaction mode.
 */
export function redactString(
  input: string,
  options: RedactionOptions
): RedactionResult
```

Redaction modes:
- `MASK`: replace with `[REDACTED]`
- `HASH`: replace with `[sha256:${first8chars}]`
- `DROP`: replace with empty string
- `PLACEHOLDER`: replace with `[${type}]` e.g. `[EMAIL]`

The redactor must run against:
- `event.tool.input` (recurse into object values)
- `event.tool.output` (recurse into object values)
- `event.llm` prompt content if captured
- Any string values in `event.metadata`

Write tests that verify every redaction mode produces the correct output for every detector type.

**Phase 3 is complete when:**
- All privacy tests pass
- The redactor correctly handles nested objects and arrays
- No detector throws on malformed input

---

## Phase 4 — Renderer

**Start this phase only after Phase 3 tests pass.**

### Step 4.1 — Human Mode Renderer

Create `packages/renderer/src/human.ts`.

This renderer converts ARLS events into beautiful terminal output. This is what developers see every day, so it must be excellent.

Output format per event type:

```
[AgentLens] ──────────────────────────────── run_00042
🤖 AGENT START  ResearchAgent
   run_id: run_00042  ·  trace_id: trace_8f3a2c

  📋 PLAN  step 1
     Decided to search for recent papers before summarizing

  🔧 TOOL CALL  step 2  →  web_search
     input:  { query: "AI agent observability 2025" }
     output: [3 results returned]
     ✅ SUCCESS  842ms

  🧠 LLM CALL  step 3  →  claude-sonnet-4-20250514
     tokens: 1540 (1200 in / 340 out)
     cost:   $0.0048
     ⏱  1320ms  ·  finish: end_turn

🏁 AGENT END  run_00042
   steps: 3  ·  tokens: 1540  ·  cost: $0.0048  ·  duration: 2.16s
[AgentLens] ──────────────────────────────────────────
```

Requirements:
- Use ANSI escape codes directly — no third-party color library in `core`
- Define a color palette as constants (do not hardcode ANSI codes inline)
- Emoji per phase: PLAN=📋, TOOL_CALL=🔧, OBSERVE=👁, REFLECT=💭, RESPOND=💬
- Status indicators: SUCCESS=✅, FAILURE=❌, TIMEOUT=⏰
- Respect `NO_COLOR` environment variable — output plain text if set
- Respect `CI` environment variable — use simpler output format without emoji

### Step 4.2 — AI Mode Renderer

Create `packages/renderer/src/ai.ts`.

This renderer outputs ARLS JSON with additional fields that make it easy for Claude Code to understand what happened and why.

Requirements:
- Output one JSON object per line (JSONL format) — never pretty-print in AI mode
- Include all standard ARLS fields
- Add `_claude_context` field with summary text Claude Code can parse:

```json
{
  "_claude_context": {
    "summary": "Tool 'web_search' succeeded in 842ms returning 3 results",
    "debug_suggestion": "If this tool is slow, consider caching results by query hash",
    "related_steps": [1, 2],
    "cost_so_far_usd": 0.0048
  }
}
```

Write tests that verify:
- AI mode output is valid JSON on every line
- Human mode output contains the correct emoji for each phase
- `NO_COLOR` env var disables ANSI codes
- Both renderers handle every `SchemaType` without throwing

**Phase 4 is complete when:**
- All renderer tests pass
- Human mode output is visually verified (write a manual test script in `examples/`)
- AI mode output is valid JSONL

---

## Phase 5 — Transport Layer

**Start this phase only after Phase 4 tests pass.**

### Step 5.1 — Base Transport

Create `packages/transport/src/base.ts`.

```typescript
/**
 * All transports implement this interface.
 * write() must never block the caller.
 * flush() drains any internal buffer and resolves when complete.
 */
export interface Transport {
  write(event: ARLSEvent, rendered: string): Promise<void>
  flush(): Promise<void>
  close(): Promise<void>
}

export abstract class BaseTransport implements Transport {
  protected queue: ARLSEvent[] = []
  protected abstract drain(): Promise<void>
  // ... async queue implementation
}
```

Requirements:
- Internal async queue with configurable max size (default: 1000 events)
- If queue is full, oldest events are dropped and a warning is logged to stderr
- `flush()` waits until queue is empty
- `close()` calls `flush()` then releases any held resources

### Step 5.2 — Console Transport

Create `packages/transport/src/console.ts`.

- Uses `process.stdout.write` directly — not `console.log` (to avoid extra newline handling)
- In `human` render mode: write the human-rendered string
- In `ai` render mode: write the ARLS JSON line
- In `both` mode: write human output to stdout, JSON output to a separate optional file

### Step 5.3 — File Transport

Create `packages/transport/src/file.ts`.

Requirements:
- Appends JSONL to a file (one ARLS JSON event per line)
- File path is configurable
- Rotates files when they exceed a configurable size (default: 50MB)
- Rotation format: `agentlens.log`, `agentlens.1.log`, `agentlens.2.log`
- Keep maximum of 5 rotated files (configurable)
- Uses `fs.promises` — never synchronous file writes

Write tests that verify:
- Events written to file are valid JSONL
- File rotation triggers at the correct size
- `flush()` ensures all queued events are written before resolving
- `close()` releases the file handle

**Phase 5 is complete when:**
- All transport tests pass
- Console and File transports pass integration tests that write real events end-to-end

---

## Phase 6 — AgentLens Public API

**Start this phase only after Phase 5 tests pass.**

This is the main entry point — the `AgentLens` class that developers import.

### Step 6.1 — Main Class

Create `packages/core/src/agentlens.ts`.

```typescript
export interface AgentLensConfig {
  agent: string
  mode?: 'human' | 'ai' | 'both'
  transport?: 'console' | 'file' | Transport
  file?: string                    // path when transport is 'file'
  privacy?: PrivacyConfig
  minLevel?: 'debug' | 'info' | 'warn' | 'error'
}

export class AgentLens {
  constructor(config: AgentLensConfig)

  /** Wraps an Anthropic client for automatic LLM call logging */
  wrap(client: Anthropic): Anthropic

  /** Wraps an OpenAI client for automatic LLM call logging */
  wrap(client: OpenAI): OpenAI

  /** Wraps any async function as a logged tool call */
  wrapTool<TInput extends unknown[], TOutput>(
    name: string,
    fn: (...args: TInput) => Promise<TOutput>
  ): (...args: TInput) => Promise<TOutput>

  /** Starts a named agent run with full context */
  startRun(options?: { name?: string }): AgentRun

  /** Manually log an event at any phase */
  log(options: ManualLogOptions): void

  /** Flush all pending transport writes */
  flush(): Promise<void>

  /** Flush and close all transports */
  close(): Promise<void>
}
```

Write an integration test that does the following end-to-end:
1. Creates an `AgentLens` instance with file transport
2. Wraps a mock Anthropic client
3. Wraps a mock tool function
4. Calls both the client and tool
5. Calls `flush()`
6. Reads the output file
7. Verifies every line is a valid ARLS JSON event
8. Verifies the events are in the correct order

**Phase 6 is complete when:**
- The integration test passes
- `AgentLens` is exported from the root `packages/core/src/index.ts`
- The full public API surface is documented with JSDoc

---

## Phase 7 — CLI

**Start this phase only after Phase 6 tests pass.**

### Step 7.1 — CLI Entry Point

Create `packages/cli/src/index.ts` as the CLI entry point.

Use only Node.js built-ins for argument parsing — no commander.js or yargs for the MVP. Keep it simple.

```
npx agentlens <command> [options]

Commands:
  init                    Scaffold AgentLens config for the current project
  trace <run_id> <file>   Visualize a specific run from a JSONL log file
  analyze <file>          Summarize agent behavior from a JSONL log file
```

### Step 7.2 — `init` Command

The `init` command:
1. Detects whether the project uses `@anthropic-ai/sdk` or `openai` by reading `package.json`
2. Generates an `agentlens.config.ts` file tailored to the detected framework
3. Prints a getting-started snippet to stdout showing how to wrap the detected client
4. Prints the 5 lines the developer needs to add to their code

### Step 7.3 — `trace` Command

The `trace` command:
1. Reads a JSONL log file
2. Filters events matching the given `run_id`
3. Renders the full run as a tree in the terminal using the human renderer
4. Shows total cost, total tokens, and duration at the bottom

### Step 7.4 — `analyze` Command

The `analyze` command:
1. Reads a JSONL log file
2. Computes: total runs, total LLM calls, total tool calls, total tokens, total cost
3. Identifies the most common tool call, the most expensive run, the most common error
4. Prints a structured summary to stdout

**Phase 7 is complete when:**
- All three commands work on a real JSONL file produced by Phase 6's integration test
- `packages/cli/package.json` has a `bin` field pointing to the compiled CLI entry point

---

## Phase 8 — Examples & Documentation

**This is the final phase of the MVP. Do not skip it.**

### Step 8.1 — Anthropic Basic Example

Create `examples/anthropic-basic/index.ts`:

```typescript
import { AgentLens } from 'agentlens'
import Anthropic from '@anthropic-ai/sdk'

const lens = new AgentLens({
  agent: 'BasicAssistant',
  mode: 'human',
  transport: 'console',
})

const client = lens.wrap(new Anthropic())

const response = await client.messages.create({
  model: 'claude-sonnet-4-20250514',
  max_tokens: 1024,
  messages: [{ role: 'user', content: 'What is observability in software engineering?' }],
})

console.log(response.content[0])
await lens.close()
```

This example must run with `ts-node examples/anthropic-basic/index.ts` and produce visible human-mode output.

### Step 8.2 — Tool Calling Example

Create `examples/tool-calling/index.ts`.

Simulate an agent that:
1. Receives a user query
2. Calls a mock `web_search` tool
3. Calls a mock `fetch_document` tool
4. Calls an LLM to synthesize the results
5. Logs the entire run

This example demonstrates the full value of AgentLens — a complete agent run visible in the terminal.

### Step 8.3 — README

Write `README.md` with these sections in this order:

1. **One-line pitch** — what AgentLens is
2. **The problem** — why black-box AI agents are painful (3 sentences max)
3. **Installation** — `npm install agentlens`
4. **Quickstart** — copy-paste code that works in under 5 minutes
5. **What you'll see** — the terminal output screenshot (describe it in a code block)
6. **Configuration reference** — table of all `AgentLensConfig` options
7. **ARLS Schema** — link to `docs/ARLS_SPEC.md`
8. **Roadmap** — Phase 2 (Python), Phase 3 (Rust), Phase 4 (Go)
9. **Contributing** — one paragraph
10. **License** — MIT

The README must not exceed 300 lines. Every code example in the README must be copy-pasteable and correct.

---

## Testing Standards

Every package must meet these testing requirements before being considered done.

| Requirement | Standard |
|---|---|
| Test runner | Vitest |
| Coverage target | 80% line coverage minimum |
| Test file location | `packages/<name>/__tests__/*.test.ts` |
| Mock policy | Use `vi.mock()` for SDK clients — never make real network calls in tests |
| Test naming | `describe('ComponentName') > it('should [behavior] when [condition]')` |
| Error testing | Every error path must have a test |
| Type tests | Use `expectTypeOf` for public API type assertions |

---

## Definition of Done — Full MVP

The MVP is complete when all of the following are true:

- [ ] `pnpm build` succeeds across all packages with zero TypeScript errors
- [ ] `pnpm test` passes across all packages with 80%+ coverage
- [ ] The Anthropic basic example runs and produces terminal output
- [ ] The tool calling example runs and shows a complete agent trace
- [ ] `npx agentlens trace` renders the tool calling example's log file correctly
- [ ] The README quickstart works in a fresh project with `npm install agentlens`
- [ ] Zero `any` types in any source file
- [ ] Every public export has a JSDoc comment
- [ ] `packages/core` has zero runtime dependencies
- [ ] The ARLS_SPEC.md is written and accurate

---

## Common Mistakes to Avoid

**Do not use `console.log` inside the library.** Use `process.stderr.write` for internal warnings. `console.log` is for the CLI only.

**Do not import `packages/interceptors` from `packages/core`.** The dependency direction is: `interceptors` depends on `core`. Never the reverse.

**Do not catch and swallow errors in interceptors.** AgentLens must be transparent. If the wrapped function throws, the caller must see that error.

**Do not write synchronous file I/O anywhere.** Not even in tests. Use `fs.promises` everywhere.

**Do not pretty-print JSON in AI mode.** JSONL format means one compact JSON object per line. No indentation.

**Do not add color codes to AI mode output.** The AI mode renderer produces plain JSON only.

**Do not make the privacy engine optional for transports.** Redaction runs before every transport write, always.

---

*This file is the single source of truth for how Claude Code should build AgentLens. When in doubt about a decision, check the PRD in `AGENTLENS_PRD.md`. When in doubt about a technical decision not covered here, default to: simpler, stricter types, better tests.*
