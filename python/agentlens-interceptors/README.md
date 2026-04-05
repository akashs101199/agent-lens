# agentlens-interceptors

SDK wrappers for automatic LLM and tool call logging.

Provides interceptors for:
- **Anthropic SDK** (`wrap_anthropic()`)
- **OpenAI SDK** (`wrap_openai()`)
- **LangChain agents** (`AgentLensCallbackHandler`)
- **Generic async functions** (`wrap_tool()`, `@ToolWrapper`)

## Installation

```bash
pip install agentlens-interceptors
```

## Quick Start

### Anthropic

```python
from anthropic import Anthropic
from agentlens_interceptors import wrap_anthropic

client = Anthropic()
client = wrap_anthropic(client)

response = await client.messages.create(
    model="claude-sonnet-4-20250514",
    max_tokens=1024,
    messages=[{"role": "user", "content": "Hello"}],
)
# All LLM calls are now automatically logged!
```

### OpenAI

```python
from openai import OpenAI
from agentlens_interceptors import wrap_openai

client = OpenAI()
client = wrap_openai(client)

response = await client.chat.completions.create(
    model="gpt-4o",
    messages=[{"role": "user", "content": "Hello"}],
)
# All LLM calls are now logged!
```

### LangChain (Python Exclusive!)

```python
from langchain.agents import create_react_agent
from agentlens_interceptors import AgentLensCallbackHandler

handler = AgentLensCallbackHandler(agent_name="MyAgent")

agent = create_react_agent(
    llm=llm,
    tools=tools,
    callbacks=[handler],  # Pass handler to LangChain
)
# All agent execution is now automatically logged!
```

### Generic Tools

```python
from agentlens_interceptors import wrap_tool, ToolWrapper

# Function wrapper
async def search(query: str) -> list[str]:
    return ["result1", "result2"]

results = await wrap_tool("web_search", search, query="AI agents")

# Decorator style
@ToolWrapper("calculator")
async def add(a: int, b: int) -> int:
    return a + b

result = await add(3, 4)
```

## Zero Dependencies

The interceptors package has zero runtime dependencies. It relies only on:
- `agentlens-core` (which itself has zero dependencies)
- SDK client libraries passed as arguments (Anthropic, OpenAI, etc.)

## Features

- ✅ Automatic token counting
- ✅ Cost calculation (USD estimates)
- ✅ Latency tracking
- ✅ Error logging
- ✅ Non-blocking event emission
- ✅ Full ARLS compliance
- ✅ No code changes required (wrap-in-place)
