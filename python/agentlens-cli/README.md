# agentlens-cli

Command-line tools for AgentLens — visualize and analyze agent logs.

## Installation

```bash
pip install agentlens-cli
```

## Commands

### `agentlens init`

Scaffold an AgentLens configuration file in your project.

```bash
agentlens init --name MyAgent
```

Creates `agentlens_config.py` with example setup code.

### `agentlens trace`

Visualize a specific run from a JSONL log file.

```bash
agentlens trace <run_id> <logfile>
```

Example:
```bash
agentlens trace run_20240101_abc123 agentlens.log
```

Displays all events for the run in a formatted view.

### `agentlens analyze`

Summarize agent behavior from a log file.

```bash
agentlens analyze <logfile>
```

Example:
```bash
agentlens analyze agentlens.log
```

Computes statistics:
- Total runs and events
- LLM call count and token usage
- Tool call counts by tool
- Error summary
- Total cost

## Usage

After scaffolding configuration:

```bash
agentlens init
```

You'll get a `agentlens_config.py` file. Edit it with your settings, then import it in your agent:

```python
from agentlens_config import lens
from anthropic import Anthropic

client = lens.wrap(Anthropic())
# All calls are now logged automatically
```

Run your agent, then analyze logs:

```bash
agentlens analyze agentlens.log
agentlens trace <run_id> agentlens.log
```

## License

MIT
