# AgentLens Python SDK Examples

Working examples demonstrating the Python SDK for AI agent observability.

## Setup

1. Install dependencies:
```bash
pip install agentlens anthropic
export ANTHROPIC_API_KEY=your-key
```

2. Run examples:
```bash
python anthropic_basic.py
python tool_calling.py
```

## Examples

### anthropic_basic.py

The simplest possible example. Wraps an Anthropic SDK client and logs a single LLM call.

**Output:**
- Human-readable colored output to console
- Shows token count and estimated cost
- Full structured event data in JSONL format

**Key concepts:**
- `AgentLens.wrap()` — wraps SDK clients
- Non-blocking async writes
- Terminal formatting with emoji

Run:
```bash
python anthropic_basic.py
```

### tool_calling.py

Complete agent workflow demonstrating:
- Multiple tool calls
- LLM calls in context
- Manual logging
- Full run tracing

**Workflow:**
1. Search for information (tool call)
2. Ask LLM to analyze (LLM call)
3. Fetch document (tool call)
4. Log agent completion

**Output:**
- JSONL logs to `research_run.log`
- Can be analyzed with: `agentlens analyze research_run.log`
- Can be traced with: `agentlens trace <run_id> research_run.log`

Run:
```bash
python tool_calling.py
agentlens analyze research_run.log
```

## Key Patterns

### 1. Basic Setup

```python
from agentlens import AgentLens, AgentLensConfig

config = AgentLensConfig(
    agent="MyAgent",
    mode="human",           # human-readable output
    transport="console",    # log to stdout
    privacy_enabled=True,   # PII redaction
)

lens = AgentLens(config)
```

### 2. Wrapping SDK Clients

```python
from anthropic import Anthropic

client = lens.wrap(Anthropic())

# All calls are now logged
response = await client.messages.create(...)
```

### 3. Wrapping Tools

```python
async def my_tool(input: str) -> str:
    # tool implementation
    return result

wrapped_tool = lens.wrap_tool("my_tool", my_tool)

# Call with full instrumentation
result = await wrapped_tool("input")
```

### 4. Manual Logging

```python
lens.log(
    schema_type="REASONING_STEP",
    agent_phase="PLAN",
    metadata={"reasoning": "..."}
)
```

### 5. Cleanup

```python
# Always flush and close when done
await lens.flush()
await lens.close()
```

## Output Formats

### Human Mode (Console)
```
🤖 AGENT START
🧠 LLM CALL  →  claude-opus-4-6
   tokens: 1540 (1200 in / 340 out)
   cost:   $0.0048
   ✅ SUCCESS  1320ms
🔧 TOOL CALL  →  web_search
   ✅ SUCCESS  842ms
🏁 AGENT END
```

### AI Mode (JSONL)
```json
{"schema_type": "LLM_CALL", "model": "claude-opus-4-6", "run_id": "run_...", ...}
{"schema_type": "TOOL_CALL", "tool": {"name": "web_search", ...}, ...}
```

## Analysis Commands

After running examples, analyze logs:

```bash
# Summary statistics
agentlens analyze research_run.log

# Visualize a specific run
agentlens trace <run_id> research_run.log
```

## Configuration Options

All examples use configurable settings:

| Setting | Default | Purpose |
|---------|---------|---------|
| `agent` | Required | Agent name for logs |
| `mode` | "human" | Output format: human, ai, both |
| `transport` | "console" | Where to send logs: console, file |
| `file_path` | N/A | Path when transport=file |
| `privacy_enabled` | True | Enable PII redaction |
| `redaction_mode` | "MASK" | How to redact: MASK, HASH, DROP, PLACEHOLDER |
| `max_queue_size` | 1000 | Max events in queue |
| `flush_interval_seconds` | 5.0 | Background flush frequency |

## Next Steps

1. **Integrate into your agent:**
   - Copy `anthropic_basic.py` as a template
   - Modify for your use case
   - Wrap your existing clients and tools

2. **Analyze your logs:**
   - Use `agentlens analyze` for statistics
   - Use `agentlens trace` to visualize runs
   - Export logs for external analysis

3. **Production setup:**
   - Use `file` transport with rotation
   - Configure privacy settings
   - Set appropriate queue sizes
   - Monitor error rates and costs

## Troubleshooting

**LLM calls not logging?**
- Ensure you wrapped the client with `lens.wrap()`
- Check that `privacy_enabled` isn't causing issues
- Verify API calls are actually being made

**Tools not showing up?**
- Use `lens.wrap_tool()` to wrap functions
- Ensure tool is actually being called
- Check for exceptions in tool execution

**Missing logs?**
- Call `await lens.flush()` before reading files
- Call `await lens.close()` at the end
- Check file_path is writable when using file transport

**Too much logging?**
- Reduce `max_queue_size` to drop old events faster
- Increase `flush_interval_seconds` to batch writes
- Disable privacy checks if not needed

## Performance

AgentLens is designed for production use:

- **Non-blocking writes** — All logging is async
- **Configurable buffering** — Control memory usage
- **Fast redaction** — Privacy runs before transport
- **Minimal overhead** — ~1-2ms per event

Typical overheads:
- Wrapping LLM call: < 1ms
- Wrapping tool call: < 1ms
- Writing to queue: < 0.1ms
- File rotation: handled in background

## Support

For issues, examples, or feature requests:
- GitHub: https://github.com/anthropics/agentlens
- Docs: https://agentlens.dev/python
