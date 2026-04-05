# AgentLens Python SDK

AI agent observability for Python — structured logging through the ARLS (AI-Readable Log Schema).

## Overview

AgentLens provides production-ready observability for Python AI agents:
- **Automatic instrumentation** of LLM clients and tool calls
- **Structured logging** using the ARLS schema
- **Cost tracking** for Claude, GPT-4, and other models
- **Privacy by default** with PII redaction
- **Non-blocking** async queues for high-performance logging

## Installation

```bash
pip install agentlens
```

### Requirements
- Python 3.11+
- asyncio support
- Optional: `anthropic` or `openai` for SDK wrapping

## Quick Start

### 1. Basic Setup

```python
from agentlens import AgentLens, AgentLensConfig

config = AgentLensConfig(
    agent="MyAgent",
    mode="human",           # human-readable output
    transport="console",    # log to stdout
)

lens = AgentLens(config)
```

### 2. Wrap an LLM Client

```python
from anthropic import Anthropic

client = lens.wrap(Anthropic())

# All calls are automatically logged
response = await client.messages.create(
    model="claude-opus-4-6-20250514",
    max_tokens=1024,
    messages=[{"role": "user", "content": "Hello!"}]
)
```

### 3. Wrap Tools

```python
async def search(query: str) -> str:
    # ... implementation
    return results

wrapped_search = lens.wrap_tool("web_search", search)
results = await wrapped_search("Python async")  # Logged!
```

### 4. Cleanup

```python
await lens.flush()  # Ensure all events are written
await lens.close()   # Release resources
```

## Architecture

The Python SDK mirrors the TypeScript implementation with Python idioms:

```
┌─────────────────┐
│  Your Agent     │
├─────────────────┤
│ LLM Client      │  ← lens.wrap(client)
│ Tools           │  ← lens.wrap_tool(name, fn)
│ Logic           │  ← lens.log(...)
└────────┬────────┘
         │ Events
         ▼
┌─────────────────┐
│   AgentLens     │
├─────────────────┤
│ Context Mgmt    │  ContextVar-based run tracking
│ Event Builder   │  Constructs ARLS events
│ Privacy Engine  │  PII detection and redaction
│ Renderer        │  Human-readable or JSON output
│ Transport       │  Async queue + file/console output
└────────┬────────┘
         │ Logs
         ▼
┌─────────────────┐
│  Outputs        │
├─────────────────┤
│ Console         │  Colored terminal output
│ File (JSONL)    │  Append-only with rotation
│ Custom          │  Implement Transport interface
└─────────────────┘
```

## Packages

The SDK is split into focused packages:

| Package | Purpose | Status |
|---------|---------|--------|
| `agentlens-core` | ARLS schema types, context, events | ✅ Core |
| `agentlens-interceptors` | SDK wrappers (Anthropic, OpenAI, LangChain, tools) | ✅ Integrated |
| `agentlens-privacy` | PII detection and redaction | ✅ Integrated |
| `agentlens-renderer` | Human and JSON output formatting | ✅ Integrated |
| `agentlens-transport` | Log persistence (console, file) | ✅ Integrated |
| `agentlens` | Meta-package with main AgentLens class | ✅ Main API |
| `agentlens-cli` | Command-line tools (init, trace, analyze) | ✅ Tooling |

## Configuration

```python
config = AgentLensConfig(
    agent="MyAgent",                    # Agent name
    mode="human",                       # "human", "ai", or "both"
    transport="console",                # "console" or "file"
    file_path="agentlens.log",         # Path for file transport
    privacy_enabled=True,               # Enable PII redaction
    redaction_mode="MASK",              # MASK, HASH, DROP, PLACEHOLDER
    max_queue_size=1000,                # Queue size
    flush_interval_seconds=5.0,         # Background flush frequency
)
```

## Features

### Client Wrapping

Wrap any supported SDK client for automatic logging:

```python
# Anthropic
from anthropic import Anthropic
client = lens.wrap(Anthropic())

# OpenAI
from openai import OpenAI
client = lens.wrap(OpenAI())
```

All API calls are logged with:
- Model name
- Token usage (input/output)
- Estimated cost
- Latency
- Status (success/failure)

### Tool Instrumentation

Trace any async function as a tool call:

```python
@lens.wrap_tool("search")
async def search(query: str) -> list[str]:
    # ... implementation
    return results
```

Or wrap after definition:

```python
wrapped = lens.wrap_tool("tool_name", your_async_function)
```

### Manual Logging

Log custom events at any point:

```python
lens.log(
    schema_type="REASONING_STEP",
    agent_phase="PLAN",
    metadata={"thought": "analyzing options..."}
)
```

Valid schema types:
- `AGENT_START` / `AGENT_END`
- `LLM_CALL` / `TOOL_CALL`
- `MEMORY_READ` / `MEMORY_WRITE`
- `REASONING_STEP`
- `ERROR`
- `COST_CHECKPOINT`

### Privacy & Redaction

PII is detected and redacted before logging:

**Detectors:**
- Email addresses
- API keys (`sk-`, `ak-`, `pk-`, `Bearer`)
- Credit card numbers (Luhn validation)
- US phone numbers
- Social security numbers
- Password fields

**Modes:**
- `MASK` → `[REDACTED]`
- `HASH` → `[sha256:abc123...]`
- `DROP` → (removed entirely)
- `PLACEHOLDER` → `[EMAIL]`, `[CREDIT_CARD]`, etc.

### Run Context

Automatic context tracking across async calls:

```python
async with lens.start_run(name="ResearchAgent") as run:
    # All events here share the same run_id and trace_id
    await search("query")
    await llm_call("prompt")
    # run_id increments step_index automatically
```

Or use context directly:

```python
from agentlens_core import get_run_context

context = get_run_context()
if context:
    print(f"Run: {context.run_id}")
    print(f"Trace: {context.trace_id}")
    print(f"Step: {context.step_index}")
```

### Output Modes

**Human Mode** (colored, emoji):
```
🤖 AGENT START  MyAgent
🧠 LLM CALL  step 1  →  claude-opus-4-6
   tokens: 1540 (1200 in / 340 out)
   cost:   $0.0048
   ✅ SUCCESS  1320ms
🔧 TOOL CALL  step 2  →  web_search
   ✅ SUCCESS  842ms
🏁 AGENT END  MyAgent
   steps: 2  ·  tokens: 1540  ·  cost: $0.0048
```

**AI Mode** (JSONL):
```json
{"schema_type":"LLM_CALL","model":"claude-opus-4-6","trace_id":"trace_...","run_id":"run_...","step_index":0,...}
{"schema_type":"TOOL_CALL","tool":{"name":"web_search",...},"trace_id":"trace_...","run_id":"run_..."...}
```

### Transports

**Console Transport:**
- Logs to stdout
- Good for development
- Supports human/ai/both modes

**File Transport:**
- Appends JSONL to file
- Auto-rotates at 50MB (configurable)
- Keeps up to 5 rotated files (configurable)
- Good for production

```python
# File transport with custom settings
config = AgentLensConfig(
    agent="ProdAgent",
    transport="file",
    file_path="/var/log/agent.jsonl",
    # Rotation settings (inherited from transport)
)
```

## Cost Tracking

Automatic cost calculation for supported models:

**Anthropic Claude:**
- `claude-opus-4-*`: $15/$75 per 1M tokens
- `claude-sonnet-4-*`: $3/$15 per 1M tokens
- `claude-haiku-*`: $0.80/$4 per 1M tokens

**OpenAI:**
- `gpt-4o`: $2.50/$10 per 1M tokens
- `gpt-4-turbo`: $10/$30 per 1M tokens
- `o1`: $15/$60 per 1M tokens

Costs appear in logs:
```
💰 Cost: $0.0048 USD
```

## CLI Tools

```bash
# Initialize a project
agentlens init --name MyAgent

# Analyze logs
agentlens analyze agentlens.log

# Visualize a run
agentlens trace <run_id> agentlens.log
```

## Performance

Designed for production use:

- **Non-blocking writes** — All I/O is async
- **Buffering** — Configurable queue (default 1000)
- **Background flushing** — Periodic writes (default 5s)
- **Fast redaction** — Runs before transport
- **Minimal overhead** — ~1-2ms per logged event

## Error Handling

AgentLens never raises exceptions:
- Transport errors → logged to stderr, event dropped
- Redaction errors → logged to stderr, event passed through
- Queue full → oldest event dropped, warning logged

This ensures your agent never crashes due to logging issues.

## Async Context

All AgentLens operations are async:

```python
# Wrapping is sync
client = lens.wrap(anthropic_client)

# But calls are async
response = await client.messages.create(...)

# And management is async
await lens.flush()
await lens.close()
```

## Type Safety

The Python SDK uses Python 3.11+ type hints:

```python
# Full type hints
config: AgentLensConfig = AgentLensConfig(agent="MyAgent")
lens: AgentLens = AgentLens(config)

# Type-safe event schemas
from agentlens_core import ARLSEvent, SchemaType
event: ARLSEvent = build_llm_event(...)
```

Passes `mypy --strict` validation.

## Examples

See `python/examples/` for complete working examples:
- `anthropic_basic.py` — Simple LLM call
- `tool_calling.py` — Multi-tool agent

Run them with:
```bash
cd examples
python anthropic_basic.py
python tool_calling.py
```

## Integration Patterns

### LangChain Agents

```python
from agentlens_interceptors import AgentLensCallbackHandler

callback = AgentLensCallbackHandler()
agent.run(
    "your question",
    callbacks=[callback]
)
```

### CrewAI Agents

```python
lens = AgentLens(config)
client = lens.wrap(Anthropic())

agent = Agent(
    role="...",
    goal="...",
    llm=client,  # Pass wrapped client
    tools=[lens.wrap_tool(name, fn) for name, fn in tools.items()]
)
```

### Custom Frameworks

```python
# Just wrap your clients and tools
llm_client = lens.wrap(your_client)
for name, func in your_tools.items():
    your_tools[name] = lens.wrap_tool(name, func)

# Everything else works as normal
```

## Troubleshooting

**Q: Logs aren't appearing?**
A: Make sure to call `await lens.flush()` and `await lens.close()`

**Q: Cost calculations seem wrong?**
A: Verify the model name matches exactly (case-sensitive)

**Q: PII not being redacted?**
A: Check `privacy_enabled=True` in config

**Q: Performance impact?**
A: Use `max_queue_size` to control memory, increase `flush_interval_seconds` to batch

## Architecture Comparison

| Feature | TypeScript | Python |
|---------|-----------|--------|
| Runtime | Node.js | Python 3.11+ |
| Async | Promise | asyncio |
| Context | AsyncLocalStorage | contextvars |
| Types | TypeScript strict | mypy --strict |
| CLI | Node CLI | Typer |
| Terminal | ANSI codes | rich library |
| LLM Tracking | Native | Native |
| LangChain | ❌ No | ✅ Yes |
| Interop | Proxy wrappers | Type-safe wrappers |

## What's Next?

1. **Integrate** — Wrap your existing agents
2. **Analyze** — Use `agentlens analyze` for insights
3. **Deploy** — Use file transport in production
4. **Monitor** — Set up alerts on error rates and costs

## Contributing

The Python SDK is open source:
- Repository: https://github.com/anthropics/agentlens
- Issues: https://github.com/anthropics/agentlens/issues
- Discussions: https://github.com/anthropics/agentlens/discussions

## License

MIT — See LICENSE file in repository
