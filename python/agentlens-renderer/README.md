# agentlens-renderer

Output formatting for ARLS events - human-readable terminal output and AI-readable JSON.

## Installation

```bash
pip install agentlens-renderer
```

## Quick Start

### Human-Readable Output

```python
from agentlens_renderer import render_human
from agentlens_core import ARLSEvent

event = ...  # Your ARLS event

# Render for terminal display (with colors)
output = render_human(event)
print(output)

# Compact single-line format
from agentlens_renderer import render_human_compact
output = render_human_compact(event)
```

### AI-Readable Output

```python
from agentlens_renderer import render_ai
import json

# Render as JSONL (one JSON object per line)
jsonl_line = render_ai(event)
# Output: {"agentlens_version":"1.0","schema_type":"LLM_CALL",...,"_claude_context":{"summary":"..."}}

# Parse it back
parsed = json.loads(jsonl_line)

# Or get as dictionary directly
from agentlens_renderer import render_ai_compact
event_dict = render_ai_compact(event)
```

## Renderers

### Human Renderer (`render_human`)

Produces beautiful terminal output with:
- 🎨 ANSI color codes (respects `NO_COLOR` env var)
- 📋 Emoji indicators for event types and status
- 🎯 Formatted numbers (tokens, costs, durations)
- 📊 Multi-line detailed information

Example output:
```
🧠 LLM CALL  step 1  →  claude-sonnet-4-20250514
   tokens: 1.5K (1.2K in / 340 out)
   cost:   $0.0087
   ⏱  1.32s  ·  finish: end_turn
```

### Compact Human Renderer (`render_human_compact`)

Single-line format for logs or monitoring:
```
🧠 LLM claude-sonnet-4-20250514 1.5K tokens $0.0087 1320ms
🔧 web_search ✅ 842ms
❌ database_query ❌ 250ms
```

### AI Renderer (`render_ai`)

Produces compact JSONL with Claude-specific context:
- **Format**: One valid JSON object per line (JSONL)
- **Fields**: All ARLS fields + `_claude_context`
- **Compression**: No pretty-printing, uses compact separators
- **Context**: Debug hints, cost summaries, performance suggestions

Example:
```json
{"agentlens_version":"1.0","schema_type":"LLM_CALL","timestamp":"2025-01-01T00:00:00Z","trace_id":"trace_123","run_id":"run_123","step_index":1,"agent":{"name":"TestAgent","phase":"PLAN","parent_decision":null},"privacy":{"pii_detected":false,"redacted_fields":[],"redaction_mode":null},"semantic_tags":[],"llm":{"model":"claude-sonnet-4-20250514","provider":"anthropic","prompt_tokens":1200,"completion_tokens":340,"total_tokens":1540,"cost_usd":0.0087,"latency_ms":1320,"finish_reason":"end_turn","time_to_first_token_ms":null},"tool":null,"memory":null,"error":null,"ai_debug_hint":null,"metadata":null,"_claude_context":{"summary":"LLM call to claude-sonnet-4-20250514 returned 340 tokens in 1320ms","cost_usd":0.0087,"step_index":1,"trace_id":"trace_1","pii_redacted":false}}
```

### Compact AI Renderer (`render_ai_compact`)

Returns dictionary instead of JSON string for programmatic use:
```python
event_dict = render_ai_compact(event)
# Returns: {
#   "agentlens_version": "1.0",
#   "schema_type": "LLM_CALL",
#   ...
#   "_claude_context": { "summary": "..." }
# }
```

## Color Support

Human renderer respects environment variables:
- **`NO_COLOR`**: Set to disable ANSI colors
- **`CI`**: Set in CI/CD pipelines, uses simpler output

```bash
# Disable colors
export NO_COLOR=1
python script.py

# In CI pipelines
export CI=true
python script.py
```

## Claude Context Fields

The `_claude_context` field includes:
- **`summary`**: One-sentence description of what happened
- **`cost_usd`**: Total USD cost (LLM calls)
- **`debug_suggestion`**: Performance or error recovery hints
- **`step_index`**: Position in trace
- **`trace_id`**: Abbreviated trace ID
- **`pii_redacted`**: Whether PII was redacted
- **`redacted_field_count`**: Number of redacted fields

## Emoji Legend

| Emoji | Meaning |
|-------|---------|
| 🤖 | Agent start/end |
| 🧠 | LLM call |
| 🔧 | Tool call |
| 💭 | Reasoning step |
| 📖 | Memory read |
| 💾 | Memory write |
| ❌ | Error event |
| ✅ | Success status |
| ⏰ | Timeout |
| ⛔ | Cancelled |
| ⚠️ | PII redacted |

## Dependencies

- `rich` - Beautiful terminal output (only dependency)
- `agentlens-core` - ARLS types and builders
