# AgentLens

**Structured observability for AI agents — understand what your agent is doing, step by step.**

## The Problem

AI agents are black boxes. You call an API, you get a response, but you have no visibility into:
- What the agent decided to do and why
- Which tools it called and in what order
- How much it spent on API calls
- Whether it made mistakes and recovered

This makes debugging, monitoring, and improving agents incredibly difficult.

## The Solution

AgentLens is an open-source TypeScript library that automatically logs every step of your agent's execution in a structured, queryable format. See exactly what your agent is thinking.

## Installation

```bash
npm install @agentlens/core @agentlens/transport @agentlens/renderer
```

Or with your SDK of choice:
```bash
npm install @agentlens/core @agentlens/transport @agentlens/interceptors
npm install @anthropic-ai/sdk  # or: npm install openai
```

## Quickstart

### 1. Initialize AgentLens

```typescript
import { AgentLens } from '@agentlens/core'
import Anthropic from '@anthropic-ai/sdk'

const lens = new AgentLens({
  agent: 'MyAssistant',
  mode: 'human',
  transport: 'console',
})

const client = lens.wrap(new Anthropic())
```

### 2. Use your SDK as normal

```typescript
const response = await client.messages.create({
  model: 'claude-3-5-sonnet-20241022',
  max_tokens: 1024,
  messages: [{ role: 'user', content: 'What is observability?' }],
})

console.log(response.content[0].text)
```

### 3. Close the logger

```typescript
await lens.close()
```

That's it! You'll see beautifully formatted logs in your terminal showing:
- ✅ LLM calls with token counts and costs
- 🔧 Tool invocations with inputs and outputs
- 💭 Reasoning steps and decisions
- ⚠️ Errors and recovery attempts
- 💰 Total tokens and cost per run

## What You'll See

In `human` mode, AgentLens renders logs like this:

```
[AgentLens] ──────────────────────────────── run_1712282400000_a3c2e5

🤖 AGENT START  MyAssistant
   run_id: run_1712282400000_a3c2e5  ·  trace_id: trace_9f1a2b

  🔧 TOOL CALL  →  web_search
     input:  { "query": "AI observability" }
     output: [3 results returned]
     ✅ SUCCESS  842ms

  🧠 LLM CALL  →  claude-3-5-sonnet-20241022
     tokens: 1540 (1200 in / 340 out)
     cost:   $0.0048
     ⏱  1320ms  ·  finish: end_turn

🏁 AGENT END  run_1712282400000_a3c2e5
   steps: 3  ·  tokens: 1540  ·  cost: $0.0048  ·  duration: 2.16s
[AgentLens] ────────────────────────────────────────────────────
```

## Configuration Reference

```typescript
interface AgentLensConfig {
  // Required: Name of your agent
  agent: string

  // Output mode (default: 'human')
  mode?: 'human' | 'ai' | 'both'

  // Where to send logs (default: 'console')
  transport?: 'console' | 'file' | CustomTransport

  // Path when transport is 'file'
  file?: string

  // Privacy settings
  privacy?: {
    enabled?: boolean           // default: true
    redactionMode?: 'MASK' | 'HASH' | 'DROP' | 'PLACEHOLDER'  // default: 'MASK'
  }

  // Minimum log level (future)
  minLevel?: 'debug' | 'info' | 'warn' | 'error'
}
```

## Core Methods

```typescript
// Wrap Anthropic/OpenAI clients for automatic logging
const client = lens.wrap(new Anthropic())

// Wrap any async function as a logged tool
const search = lens.wrapTool('search', async (query) => {
  return await fetch(`/api/search?q=${query}`)
})

// Start a named run with context tracking
const run = lens.startRun({ name: 'MyAgent' })
await run.exec(async () => {
  // All calls here share the same run_id and trace_id
})

// Manually log events
lens.log({
  schemaType: 'REASONING_STEP',
  phase: 'REFLECT',
  metadata: { content: 'Need more context...' },
})

// Flush pending logs and close
await lens.close()
```

## ARLS Schema

AgentLens uses the **AI-Readable Log Schema (ARLS)** — a versioned JSON standard that's readable by both humans and AI dev tools like Claude Code.

Learn more: [docs/ARLS_SPEC.md](docs/ARLS_SPEC.md)

## CLI Tools

After logging, analyze your agent's behavior with the CLI:

```bash
# Scaffold configuration
npx agentlens init

# View a specific run
npx agentlens trace run_1234567890_abc def agentlens.log

# Summarize all runs
npx agentlens analyze agentlens.log
```

## Examples

- **[Anthropic Basic](examples/anthropic-basic/)** — Simple Anthropic SDK example
- **[Tool Calling](examples/tool-calling/)** — Multi-step agent with tools and reasoning

## Roadmap

- **Phase 2 (2025)** — Python SDK (`pip install agentlens`)
- **Phase 3 (2025)** — Rust SDK (`cargo add agentlens`)
- **Phase 4 (2026)** — Go SDK (`go get github.com/akashs101199/agentlens`)
- **Dashboards** — Web UI for analyzing agent runs
- **Cloud Storage** — S3 / GCS integration for logs

## Contributing

We welcome contributions! The codebase is organized as a monorepo with these packages:

- `@agentlens/core` — Schema and public API
- `@agentlens/interceptors` — SDK wrappers
- `@agentlens/privacy` — PII detection and redaction
- `@agentlens/renderer` — Event rendering (human + AI modes)
- `@agentlens/transport` — Event persistence
- `@agentlens/cli` — Command-line tools

See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup.

## License

MIT — See [LICENSE](LICENSE) for details.

---

**Questions?** Open an issue on [GitHub](https://github.com/akashs101199/agent-lens)
