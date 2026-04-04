# AgentLens — Product Requirements Document

> **Version:** 1.0  
> **Type:** Personal Open Source Project  
> **Status:** Planning  
> **Tagline:** Open the black box. Build AI you can trust.

---

## Table of Contents

1. [Problem Statement](#1-problem-statement)
2. [Vision](#2-vision)
3. [Target Users](#3-target-users)
4. [Core Features](#4-core-features)
5. [AI-Readable Log Schema (ARLS)](#5-ai-readable-log-schema-arls)
6. [System Architecture](#6-system-architecture)
7. [Language Strategy](#7-language-strategy)
8. [Phase Roadmap](#8-phase-roadmap)
9. [MVP Scope](#9-mvp-scope)
10. [API Design](#10-api-design)
11. [Success Metrics](#11-success-metrics)
12. [Competitive Landscape](#12-competitive-landscape)
13. [Open Source Strategy](#13-open-source-strategy)

---

## 1. Problem Statement

Modern AI agents — built with LangChain, AutoGPT, CrewAI, the Anthropic SDK, or custom loops — operate as **black boxes**. When something goes wrong, developers have no visibility into:

- What the agent decided and **why**
- Which tool was called with what input and what it returned
- Where in a multi-step reasoning chain the failure occurred
- How many tokens were consumed and at what cost
- Whether sensitive data leaked into a log

Standard logging libraries (`pino`, `winston`, `logging`) were designed for request/response systems. They have zero awareness of agent phases, tool calls, LLM context windows, or reasoning steps.

### Current Pain Points

| Pain Point | Real Impact |
|---|---|
| No agent-aware logging primitives | Printf debugging across massive token streams |
| Tool calls are invisible | Cannot trace why an agent chose a tool or what it returned |
| Token usage is opaque | Cost blowouts with no audit trail |
| Multi-step reasoning is untraceable | A wrong answer offers no path to the failing step |
| AI dev tools cannot read agent logs | Claude Code and Copilot cannot assist in debugging |
| No standard log schema for AI | Every team reinvents observability from scratch |
| PII leaks into logs silently | User data exposed to third-party logging backends |

---

## 2. Vision

AgentLens is a **zero-overhead, framework-agnostic logging library built for the AI era**.

It makes every decision an agent takes — every tool call, every prompt, every model response, every reasoning step — **fully observable, traceable, and understandable by both humans and AI development tools**.

### What Makes AgentLens Different

Most observability tools are built for SaaS platforms (LangSmith, Datadog LLM Observability). AgentLens is a **library first** — it runs in your process, works offline, has no required cloud backend, and produces logs in a format that AI dev tools like Claude Code can read and act on autonomously.

AgentLens introduces the **AI-Readable Log Schema (ARLS)** — an open, versioned JSON standard designed to be consumed by both developers and AI coding assistants. This is the key innovation.

---

## 3. Target Users

| Persona | Primary Need |
|---|---|
| AI Application Developer | Debug agent loops, trace reasoning failures, understand tool call chains |
| DevOps / SRE Engineer | Production observability, cost monitoring, alerting on agent errors |
| AI Research Engineer | Reproduce agent runs, compare prompt strategies, log experiment results |
| Developer using Claude Code | AI co-pilot reads structured logs and automatically suggests fixes |
| Startup CTO | Add production-grade observability to an AI product without building it from scratch |
| OSS / Indie Developer | Free, lightweight, well-documented tool they can ship with a side project |

---

## 4. Core Features

### F-01 — Agent-Aware Structured Logging

Every log entry is automatically enriched with agent context: active agent name, run ID, step index, parent span, and execution phase. Context propagates across async boundaries automatically.

- Automatic `run_id` and `trace_id` generation and propagation
- Agent phase tagging: `PLAN`, `TOOL_CALL`, `OBSERVE`, `REFLECT`, `RESPOND`
- Step-level and token-level granularity
- Full causal chain — each log entry knows its parent decision

### F-02 — Dual-Mode Log Rendering

One log event, two audiences. The same event is rendered in human-friendly terminal output AND as machine-parseable JSON that AI dev tools can consume natively.

- **Human mode:** colored, indented, emoji-annotated terminal output
- **AI mode:** structured JSON with agent schema version, semantic tags, and metadata
- Toggle per-environment: human in dev, AI-schema in CI and production
- Claude Code integration: emit logs in a format Claude Code understands natively for autonomous debugging

### F-03 — LLM Call Interceptor

Wrap any LLM SDK call and automatically capture full observability data without changing business logic.

- Captures: model name, provider, prompt, completion, finish reason
- Token usage: `prompt_tokens`, `completion_tokens`, `total_tokens`, estimated cost in USD
- Latency: time-to-first-token, total latency in ms
- Compatible with: Anthropic SDK, OpenAI SDK, Google Gemini, LiteLLM, LangChain

### F-04 — Tool Call Trace Engine

The most critical gap in current AI observability. Every tool call is traced with full input/output capture, timing, and success/failure status.

- Captures: tool name, input args, output, duration, status
- Detects: tool call loops, repeated failures, unexpected output shapes
- Visual trace tree: see the full decision → action → observation chain
- OpenTelemetry spans as first-class output

### F-05 — Reasoning & Memory Logger

Capture what the agent *thought*, not just what it did.

- Log chain-of-thought and scratchpad content at configurable verbosity levels
- Memory operation logging: vector DB reads, cache hits, context injections
- Context window utilization tracking: token budget vs actual usage
- Semantic similarity logging for RAG pipelines

### F-06 — Privacy & Compliance Engine

AI agents process sensitive user data. AgentLens provides automatic PII detection and redaction before anything reaches your logging backend.

- Built-in detectors: email, phone number, SSN, credit card, API keys, passwords
- Custom regex redaction rules configurable per project
- Redaction modes: `MASK`, `HASH`, `DROP`, `PLACEHOLDER`
- Compliance flags: mark log entries as GDPR-sensitive or HIPAA-sensitive

### F-07 — AI-Readable Log Schema (ARLS)

AgentLens defines an open schema standard for AI agent logs. This is the feature that makes this library a community asset, not just a personal tool.

- Versioned JSON schema with semantic field names AI tools understand
- Semantic tags: `agent.decision_reason`, `tool.expected_behavior`, `error.recovery_hint`
- Machine-readable error taxonomy: `CONTEXT_OVERFLOW`, `TOOL_FAILURE`, `LOOP_DETECTED`
- Export format Claude Code and GitHub Copilot can ingest for auto-debugging

### F-08 — Multi-Backend Transport Layer

Pluggable adapter architecture. Log to any destination without changing application code.

- Built-in adapters: Console, File, ELK Stack, Datadog, Grafana Loki, OpenTelemetry Collector
- Config-driven backend switching per environment
- Async, non-blocking transports — zero added latency to the agent
- Batching and retry logic built into every transport adapter

### F-09 — Natural Language Log Query Interface

Query your agent logs in plain English.

- "Show me all failed tool calls in the last 100 runs"
- "Find all runs where the agent called a tool more than 5 times in a row"
- "Show token usage spikes over $0.10 per run"
- Translates to Elasticsearch DSL / Loki LogQL / in-memory filter automatically

### F-10 — CLI Companion Tool

A standalone CLI that uses AgentLens to analyze a codebase and generate a logging setup, or analyze an existing log file.

- `npx agentlens init` — auto-detect framework and scaffold config
- `npx agentlens analyze ./run.log` — parse a log file and summarize agent behavior
- `npx agentlens trace <run_id>` — visualize a full agent run as a tree in the terminal
- `npx agentlens report` — generate a human-readable run report as HTML or markdown

---

## 5. AI-Readable Log Schema (ARLS)

This is the core schema every AgentLens log event conforms to. Versioned and open.

```json
{
  "agentlens_version": "1.0",
  "schema_type": "TOOL_CALL",
  "timestamp": "2025-07-14T10:32:11.421Z",
  "trace_id": "trace_8f3a2c1d9e4b",
  "run_id": "run_00042",
  "step_index": 7,
  "agent": {
    "name": "ResearchAgent",
    "phase": "TOOL_CALL",
    "parent_decision": "User asked for recent AI papers"
  },
  "tool": {
    "name": "web_search",
    "input": { "query": "AI agent observability 2025" },
    "output": "[...results truncated...]",
    "status": "SUCCESS",
    "duration_ms": 842
  },
  "llm": {
    "model": "claude-sonnet-4-20250514",
    "provider": "anthropic",
    "prompt_tokens": 1200,
    "completion_tokens": 340,
    "total_tokens": 1540,
    "cost_usd": 0.0048,
    "latency_ms": 1320,
    "finish_reason": "end_turn"
  },
  "memory": {
    "context_window_used_pct": 62,
    "vector_db_reads": 3,
    "cache_hit": false
  },
  "privacy": {
    "pii_detected": false,
    "redacted_fields": []
  },
  "semantic_tags": ["research", "web_access"],
  "error": null,
  "ai_debug_hint": "Tool returned 0 results. Check query reformulation logic."
}
```

### Schema Types

| Type | When It Is Used |
|---|---|
| `AGENT_START` | Agent run begins |
| `AGENT_END` | Agent run completes with final output and total cost |
| `LLM_CALL` | Any call to an LLM provider |
| `TOOL_CALL` | Any tool or function call by the agent |
| `MEMORY_READ` | Vector DB query or cache lookup |
| `MEMORY_WRITE` | Context injection or memory update |
| `REASONING_STEP` | Chain-of-thought or scratchpad entry |
| `ERROR` | Any caught exception with recovery context |
| `COST_CHECKPOINT` | Running cost summary at configurable intervals |

---

## 6. System Architecture

AgentLens is a layered library. Each layer is independently usable and testable.

```
┌─────────────────────────────────────────────────────┐
│                  Your AI Application                 │
└────────────────────────┬────────────────────────────┘
                         │ import / wrap
┌────────────────────────▼────────────────────────────┐
│              AgentLens Public API                    │
│   createAgent()  wrap()  log()  trace()  query()     │
└──────┬──────────┬──────────┬──────────┬─────────────┘
       │          │          │          │
┌──────▼──┐ ┌────▼────┐ ┌───▼────┐ ┌──▼──────────┐
│Intercep-│ │Privacy  │ │Context │ │Query        │
│ tors    │ │Engine   │ │Propagat│ │Engine       │
│LLM/Tool │ │PII Scan │ │ion     │ │NL → DSL     │
└──────┬──┘ └────┬────┘ └───┬────┘ └─────────────┘
       │          │          │
┌──────▼──────────▼──────────▼──────────────────────┐
│                 Core Event Builder                  │
│         ARLS Schema v1  ·  run_id / trace_id        │
└────────────────────┬───────────────────────────────┘
                     │
┌────────────────────▼───────────────────────────────┐
│                   Renderer                          │
│     Human Mode (terminal)  ·  AI Mode (JSON)        │
└────────────────────┬───────────────────────────────┘
                     │
┌────────────────────▼───────────────────────────────┐
│               Transport Layer                       │
│   Console  File  ELK  Datadog  Loki  OpenTelemetry  │
└────────────────────────────────────────────────────┘
```

### Package Structure

```
agentlens/
├── packages/
│   ├── core/          # TypeScript — schema, context, event builder
│   ├── interceptors/  # TypeScript — LLM + tool wrappers
│   ├── privacy/       # TypeScript — PII detection + redaction
│   ├── renderer/      # TypeScript — human + AI mode renderers
│   ├── transport/     # TypeScript — Console, File, ELK, Datadog, Loki
│   ├── query/         # TypeScript — NL → log query engine
│   ├── cli/           # TypeScript — npx agentlens commands
│   └── python-sdk/    # Python — wraps core via JSON protocol
├── docs/
├── examples/
└── ARLS_SPEC.md       # Open schema specification
```

---

## 7. Language Strategy

### Why This Stack Stands Out

Most logging libraries are written in a single language and target one ecosystem. AgentLens ships across the full AI developer stack.

| Language | Role | Why |
|---|---|---|
| **TypeScript** | Primary — core library | Entire AI tooling ecosystem is here: LangChain.js, Vercel AI SDK, Claude Code, OpenAI SDK. Strict types enforce the ARLS schema. Ships to npm. |
| **Python** | SDK — Phase 2 | Most production agents are Python: LangChain, CrewAI, AutoGPT, DSPy, LlamaIndex. Required for serious adoption. Ships to PyPI. |
| **Rust** | Performance core — Phase 3 | Standout differentiator. Hot-path schema serialization and PII scanning compiled to WASM. Microsecond overhead. Will get attention from Datadog, New Relic, Cloudflare. |
| **Go** | Sidecar transport — Phase 4 | Lightweight high-volume log shipping daemon. Shows infrastructure-level thinking. |

### Phased Language Rollout

- **Phase 1:** TypeScript only. Ship it right.
- **Phase 2:** Python SDK. Ship to PyPI with interceptors for LangChain and Anthropic Python SDK.
- **Phase 3:** Rust core compiled to WASM, replacing the TypeScript hot path. Publish benchmarks.
- **Phase 4:** Go sidecar for production-volume transport to ELK, Datadog, Loki.

---

## 8. Phase Roadmap

### Phase 1 — TypeScript Core + CLI (MVP)

**Goal:** One-line LLM wrapping with beautiful logs and full ARLS schema.

- TypeScript monorepo with `packages/core`, `packages/interceptors`, `packages/renderer`, `packages/transport`, `packages/cli`
- LLM interceptors for Anthropic SDK and OpenAI SDK
- Human-mode terminal renderer (colored, emoji-annotated, indented trace tree)
- AI-mode JSON renderer (ARLS v1 schema, Claude Code compatible)
- Console and File transports
- Basic PII masking (email, API keys, passwords)
- CLI: `init`, `trace`, `analyze`
- Published to npm as `agentlens`
- README with 5-minute quickstart, JSDoc on all public APIs

### Phase 2 — Python SDK + Extended Interceptors

**Goal:** Cover the Python AI ecosystem.

- Python SDK published to PyPI as `agentlens`
- LangChain callback handler
- Anthropic Python SDK interceptor
- CrewAI and AutoGPT integration guides
- Shared ARLS schema via code generation (TypeScript → Python dataclasses)

### Phase 3 — Rust Performance Core

**Goal:** Zero-cost observability and the differentiating technical signal.

- Rust crate for schema serialization, PII scanning, event buffering
- Compiled to WebAssembly, consumed by TypeScript core
- Benchmark suite: AgentLens overhead vs raw logging vs no logging
- Target: under 500 microseconds added per event on hot path

### Phase 4 — Production Transports + Query Engine

**Goal:** Production-ready for real deployed AI systems.

- ELK Stack, Datadog, Grafana Loki, OpenTelemetry Collector transports
- Natural language log query interface
- Go sidecar transport daemon for high-volume log shipping
- Dashboard templates for Kibana and Grafana

---

## 9. MVP Scope

### In Scope

- TypeScript library with zero required external runtime dependencies
- LLM interceptor for Anthropic SDK (`@anthropic-ai/sdk`)
- LLM interceptor for OpenAI SDK (`openai`)
- Full ARLS v1 schema implementation with TypeScript types
- Human-mode terminal renderer: colored output, emoji phase indicators, indented trace tree
- AI-mode JSON renderer: Claude Code and Copilot compatible structured output
- File and Console transport adapters
- Basic PII masking: email addresses, API keys, bearer tokens
- `npx agentlens init` and `npx agentlens trace <run_id>` CLI commands
- 100% TypeScript strict mode
- Full JSDoc on all public APIs
- README with 5-minute quickstart and copy-paste examples
- MIT license

### Out of Scope for MVP

- Python SDK
- ELK / Datadog / Loki transports
- Natural language query interface
- Rust performance core
- Memory and RAG logging
- Web dashboard

---

## 10. API Design

### Core Usage

```typescript
import { AgentLens } from 'agentlens'
import Anthropic from '@anthropic-ai/sdk'

const lens = new AgentLens({
  agent: 'ResearchAgent',
  mode: 'human',           // 'human' | 'ai' | 'both'
  transport: 'console',    // 'console' | 'file' | 'elk' | 'datadog'
  privacy: {
    redact: ['email', 'api_key'],
    mode: 'mask',
  },
})

// Wrap any Anthropic client — one line, zero business logic change
const client = lens.wrap(new Anthropic())

// All calls through this client are automatically logged
const response = await client.messages.create({
  model: 'claude-sonnet-4-20250514',
  max_tokens: 1024,
  messages: [{ role: 'user', content: 'Summarize recent AI research' }],
})
```

### Tool Call Tracing

```typescript
// Wrap any tool function — input, output, and duration logged automatically
const searchTool = lens.wrapTool('web_search', async (query: string) => {
  return await mySearchFunction(query)
})

// Or use the decorator-style API
class ResearchAgent {
  @lens.trace('fetch_paper')
  async fetchPaper(url: string) {
    return await fetch(url)
  }
}
```

### Manual Logging

```typescript
// Log agent decisions and reasoning steps manually
lens.log({
  phase: 'PLAN',
  message: 'Decided to search for recent papers before summarizing',
  metadata: { query_count: 3 }
})

// Start an explicit agent run with full trace
const run = lens.startRun({ name: 'research-task-042' })
run.step('Fetching papers')
run.end({ success: true, output: result })
```

### Human-Mode Terminal Output

```
[AgentLens] ─────────────────────────────────────── run_00042
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
   total steps: 3  ·  total tokens: 1540  ·  total cost: $0.0048
   duration: 2.16s  ·  status: SUCCESS
[AgentLens] ───────────────────────────────────────────────────
```

---

## 11. Success Metrics

| Metric | Target |
|---|---|
| npm weekly downloads at 6 months | 1,000+ |
| GitHub stars at 3 months | 200+ |
| Time-to-first-log for a new user | Under 5 minutes |
| Added latency per LLM call (Phase 1) | Under 2ms |
| Added latency per LLM call (Phase 3 with Rust) | Under 0.5ms |
| External PRs within 3 months of launch | 3+ |
| Other tools adopting ARLS schema within 6 months | 2+ |

---

## 12. Competitive Landscape

| Tool | Gap AgentLens Fills |
|---|---|
| LangSmith | Proprietary, LangChain-only, no offline mode, no AI-readable schema |
| Datadog LLM Observability | SaaS-only, expensive, not library-first, no open schema |
| Helicone | Proxy-based (adds network hop), no agent-phase awareness |
| OpenTelemetry | No AI-specific semantic conventions yet — AgentLens can propose them |
| Arize Phoenix | Python-only, ML eval focus, not lightweight library-first |
| pino / winston / logging | Zero AI awareness, no ARLS schema, no LLM interceptors |

---

## 13. Open Source Strategy

- **MIT license** — maximum adoption, zero friction for enterprise use
- **Publish to npm and PyPI** with semantic versioning from day one
- **Public roadmap** on GitHub Discussions — community votes on features
- **ARLS_SPEC.md** published as a standalone open RFC — invite other tools to adopt it
- **"AgentLens compatible" badge** for other AI libraries to display
- **Launch post** on dev.to and Hacker News: *"I got tired of black-box AI agents so I built this"*
- **Example projects** in `/examples`: a LangChain research agent, a tool-using Anthropic agent, a CrewAI workflow — all fully instrumented

---

*AgentLens is a personal open source project. Built by one developer who was tired of debugging AI agents in the dark.*
