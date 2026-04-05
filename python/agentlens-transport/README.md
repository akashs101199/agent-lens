# agentlens-transport

Async, non-blocking transport layer for log event persistence.

## Installation

```bash
pip install agentlens-transport
```

## Quick Start

### Console Transport (stdout)

```python
from agentlens_transport import ConsoleTransport
import asyncio

async def main():
    transport = ConsoleTransport()

    # Events are queued and flushed asynchronously
    await transport.write(event, json_line)
    await transport.flush()
    await transport.close()

asyncio.run(main())
```

### File Transport (JSONL)

```python
from agentlens_transport import FileTransport
import asyncio

async def main():
    transport = FileTransport(
        path="agentlens.log",
        max_file_size=50 * 1024 * 1024,  # 50MB
        max_rotations=5
    )

    # Writes to file, auto-rotates when size exceeded
    await transport.write(event, json_line)
    await transport.flush()
    await transport.close()

asyncio.run(main())
```

### Compact File Transport

```python
from agentlens_transport import CompactFileTransport

# Smaller defaults: 10MB file size, 3 rotations
transport = CompactFileTransport("compact.log")
```

## Transport Interface

All transports implement:

```python
class Transport:
    async def write(event: ARLSEvent, rendered: str) -> None:
        """Queue an event for writing (non-blocking)"""

    async def flush() -> None:
        """Flush all pending events to storage"""

    async def close() -> None:
        """Close transport and release resources"""
```

## Key Features

### Non-Blocking Writes

Writes are queued in memory and processed asynchronously:

```python
# This returns immediately, doesn't wait for I/O
await transport.write(event, json_line)

# Later, actually write to storage
await transport.flush()
```

### Async Queue Management

- Configurable queue size (default: 1000 events)
- Automatic dropping of oldest events when full
- Background flush task (optional)

### File Rotation

Automatically rotates files when they exceed size limit:

```
agentlens.log      (current)
agentlens.1.log    (oldest)
agentlens.2.log
agentlens.3.log
agentlens.4.log
agentlens.5.log    (newest before discard)
```

## Configuration

```python
from agentlens_transport import TransportConfig, FileTransport

config = TransportConfig(
    max_queue_size=1000,           # Max queued events
    flush_interval_seconds=5.0      # Background flush frequency
)

transport = FileTransport(
    path="agentlens.log",
    max_file_size=50 * 1024 * 1024, # 50MB
    max_rotations=5,                # Keep 5 rotated files
    config=config
)
```

## Performance Considerations

### Queue Size

- Larger queue → more memory, but tolerates traffic spikes
- Smaller queue → drops old events when full, logs warning

### Flush Interval

- More frequent → lower latency, more I/O
- Less frequent → higher latency, fewer operations

## Error Handling

Transports never raise exceptions:

- Write errors → logged to stderr, event dropped
- Rotation errors → logged to stderr, continues writing
- Queue full → oldest event dropped, warning to stderr

## Async Usage

All transport operations are async:

```python
async with FileTransport("log.jsonl") as transport:
    for event in events:
        await transport.write(event, json_line)
    await transport.close()
```

## Dependencies

- `aiofiles` - Async file I/O
- `agentlens-core` - ARLS types
