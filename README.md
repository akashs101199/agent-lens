# AgentLens

AI agent observability — structured logging for LLM calls, tool calls, and reasoning steps.

## What is AgentLens?

AgentLens provides developers with a structured, machine-readable log format (ARLS) that captures every important event in an AI agent's execution. No more black-box AI — see exactly what your agents are doing, why they're doing it, and how much it costs.

## Features

- **ARLS Schema**: AI-Readable Log Schema — a versioned JSON standard for agent events
- **Zero Runtime Dependencies**: The core library is completely dependency-free
- **TypeScript Strict Mode**: Every file passes `tsc --strict` with zero errors
- **Privacy First**: Automatic PII redaction before any event reaches a transport
- **Multiple Renderers**: Human-readable terminal output and AI-optimized JSON
- **SDK Interceptors**: Automatic logging for Anthropic and OpenAI SDKs
- **Async Transport**: Non-blocking writes to console or file

## Project Status

This is the **Phase 1** monorepo setup for AgentLens. The core package is fully implemented with:

- ✅ ARLS Schema types
- ✅ Context propagation with AsyncLocalStorage
- ✅ Event builders for all event types
- ✅ Typed error classes
- ✅ Comprehensive test coverage (43 tests passing)

## Directory Structure

```
agentlens/
├── packages/
│   ├── core/              # Core ARLS schema and event builders
│   ├── interceptors/      # SDK interceptors (Anthropic, OpenAI, tools)
│   ├── privacy/           # PII detection and redaction
│   ├── renderer/          # Human and AI mode renderers
│   ├── transport/         # Console and file transports
│   └── cli/               # Command-line interface
├── examples/              # Usage examples
├── docs/                  # Documentation
├── pnpm-workspace.yaml    # Monorepo configuration
└── tsconfig.base.json     # Shared TypeScript configuration
```

## Development

### Install Dependencies

```bash
pnpm install
```

### Build All Packages

```bash
pnpm build
```

### Run All Tests

```bash
pnpm test
```

### Type Check

```bash
pnpm typecheck
```

### Lint

```bash
pnpm lint
```

## Next Phase

Phase 2 will implement the SDK interceptors:
- Tool interceptor (generic async function wrapper)
- Anthropic SDK interceptor
- OpenAI SDK interceptor

## License

MIT
