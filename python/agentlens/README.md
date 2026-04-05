# agentlens

Main public API package for AgentLens — AI agent observability through structured logging.

This is the **all-in-one** package that depends on all other AgentLens packages:
- `agentlens-core` — ARLS schema types and context propagation
- `agentlens-interceptors` — SDK wrappers for Anthropic, OpenAI, LangChain
- `agentlens-privacy` — PII detection and redaction
- `agentlens-renderer` — Terminal output formatting
- `agentlens-transport` — Log persistence to console or file

## Installation

```bash
pip install agentlens
```

## Quick Start

```python
from agentlens import AgentLens, AgentLensConfig
from anthropic import Anthropic

# Configure AgentLens
config = AgentLensConfig(
    agent='MyAgent',
    mode='human',           # 'human', 'ai', or 'both'
    transport='console'     # 'console' or 'file'
)

lens = AgentLens(config)

# Wrap your SDK client
client = lens.wrap(Anthropic())

# All calls are now logged automatically
response = await client.messages.create(
    model='claude-sonnet-4-20250514',
    max_tokens=1024,
    messages=[{'role': 'user', 'content': 'What is observability?'}]
)

# Flush and close
await lens.flush()
await lens.close()
```

## Configuration

```python
config = AgentLensConfig(
    agent='MyAgent',                    # Agent name for logs
    mode='human',                       # Output mode: 'human', 'ai', 'both'
    transport='console',                # Transport: 'console' or 'file'
    file_path='agentlens.log',         # Path when transport='file'
    privacy_enabled=True,               # Enable PII redaction
    redaction_mode='MASK',              # MASK, HASH, DROP, PLACEHOLDER
    max_queue_size=1000,                # Max queued events
    flush_interval_seconds=5.0          # Background flush interval
)
```

## Wrapping SDK Clients

### Anthropic

```python
from agentlens import AgentLens, AgentLensConfig
from anthropic import Anthropic

lens = AgentLens(AgentLensConfig(agent='MyAgent', transport='console'))
client = lens.wrap(Anthropic())

# All messages.create() calls are logged
response = await client.messages.create(...)
```

### OpenAI

```python
from agentlens import AgentLens, AgentLensConfig
from openai import OpenAI

lens = AgentLens(AgentLensConfig(agent='MyAgent', transport='console'))
client = lens.wrap(OpenAI())

# All chat.completions.create() calls are logged
response = await client.chat.completions.create(...)
```

## Wrapping Tools

```python
async def search(query: str) -> list[str]:
    # ... search implementation
    return results

lens = AgentLens(AgentLensConfig(agent='MyAgent', transport='console'))
wrapped_search = lens.wrap_tool('web_search', search)

# Tool calls are logged with input/output/duration
results = await wrapped_search('AI observability')
```

## Agent Runs

```python
async with lens.start_run(name='MyAgent') as run:
    # All events here share the same run_id and trace_id
    response = await client.messages.create(...)
    results = await wrapped_search('query')
    # run.context contains run_id, trace_id, step_index
```

## Manual Logging

```python
lens.log(
    schema_type='REASONING_STEP',
    agent_phase='PLAN',
    metadata={'reasoning': 'Analyzing the query...'}
)
```

## Output Modes

### Human Mode (Terminal Output)

Beautiful, colored terminal output with emoji and formatting:

```
[AgentLens] ──────────────────────────────── run_00042
🤖 AGENT START  MyAgent
   run_id: run_00042  ·  trace_id: trace_8f3a2c

🧠 LLM CALL  step 1  →  claude-sonnet-4-20250514
   tokens: 1540 (1200 in / 340 out)
   cost:   $0.0048
   ✅ SUCCESS  1320ms
```

### AI Mode (JSONL Output)

Compact JSON-per-line format optimized for Claude Code analysis:

```json
{"schema_type": "LLM_CALL", "model": "claude-sonnet-4-20250514", ...}
```

### Both Modes

Output to both human-readable and AI-readable formats.

## Transports

### Console Transport

Logs to stdout. Default.

```python
config = AgentLensConfig(
    agent='MyAgent',
    transport='console',
    mode='human'
)
```

### File Transport

Logs to JSONL file with automatic rotation:

```python
config = AgentLensConfig(
    agent='MyAgent',
    transport='file',
    file_path='agentlens.log',
    mode='ai'  # Usually AI mode for file
)
```

File rotation:
- Rotates at 50MB by default
- Keeps up to 5 rotated files
- Format: `agentlens.log`, `agentlens.1.log`, etc.

## Privacy & Redaction

PII redaction is enabled by default. Detects and redacts:
- Email addresses
- API keys
- Credit card numbers
- Phone numbers
- Social security numbers
- Password fields in JSON

Redaction modes:
- `MASK` — replace with `[REDACTED]`
- `HASH` — replace with `[sha256:...]`
- `DROP` — remove entirely
- `PLACEHOLDER` — replace with `[EMAIL]`, `[CREDIT_CARD]`, etc.

## Async/Await

All AgentLens operations are async:

```python
lens = AgentLens(config)

# Write events (non-blocking, queued)
await lens.log(schema_type='AGENT_START', agent_phase='PLAN')

# Flush queued events
await lens.flush()

# Close and release resources
await lens.close()
```

## Performance

- **Queue size**: Default 1000 events. Increases to tolerate traffic spikes.
- **Flush interval**: Default 5 seconds. Decrease for lower latency, increase for fewer I/O ops.
- **Non-blocking writes**: All transport writes are async and queued.
- **Automatic redaction**: PII redaction happens before transport, not during rendering.

## Error Handling

AgentLens never raises exceptions:
- Transport errors → logged to stderr, event dropped
- Redaction errors → logged to stderr, event passed through
- Queue full → oldest event dropped, warning to stderr

## Dependencies

This meta-package brings in all AgentLens dependencies:
- `agentlens-core` (zero dependencies)
- `agentlens-interceptors`
- `agentlens-privacy`
- `agentlens-renderer` (depends on `rich` for beautiful terminal output)
- `agentlens-transport` (depends on `aiofiles` for async file I/O)

## License

MIT
