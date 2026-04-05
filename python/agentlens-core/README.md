# agentlens-core

Core package for AgentLens Python SDK.

Provides:
- ARLS schema types (dataclasses)
- Run context propagation (contextvars-based)
- Event builders for creating ARLS log events
- Typed error classes
- LLM cost calculation

## Installation

```bash
pip install agentlens-core
```

## Quick Start

```python
from agentlens_core import (
    create_run_context,
    build_llm_event,
    ARLSEvent,
)

# Create a run context
ctx = create_run_context("MyAgent")

# Build events
event = build_llm_event(
    model="claude-sonnet-4-20250514",
    provider="anthropic",
    prompt_tokens=100,
    completion_tokens=50,
    cost_usd=0.001,
    latency_ms=500,
    finish_reason="end_turn",
)

print(event.to_dict())
```

## Zero Dependencies

This package has zero runtime dependencies. It uses only Python standard library.
