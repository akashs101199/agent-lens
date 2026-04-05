"""Tests for base transport class."""

import asyncio
from typing import Optional

import pytest

from agentlens_core import (
    ARLSEvent,
    SchemaType,
    AgentContext,
    AgentPhase,
    PrivacyData,
)
from agentlens_transport.base import BaseTransport, TransportConfig


class MockTransport(BaseTransport):
    """Mock transport for testing."""

    def __init__(self, config: Optional[TransportConfig] = None) -> None:
        """Initialize mock transport."""
        super().__init__(config)
        self.written_events: list[tuple[ARLSEvent, str]] = []

    async def drain(self, event: ARLSEvent, rendered: str) -> None:
        """Store event in memory."""
        self.written_events.append((event, rendered))


class TestTransportConfig:
    """Test transport configuration."""

    def test_default_config(self) -> None:
        """Default config has sensible defaults."""
        config = TransportConfig()

        assert config.max_queue_size == 1000
        assert config.flush_interval_seconds == 5.0

    def test_custom_config(self) -> None:
        """Can customize transport config."""
        config = TransportConfig(max_queue_size=100, flush_interval_seconds=1.0)

        assert config.max_queue_size == 100
        assert config.flush_interval_seconds == 1.0


class TestBaseTransport:
    """Test base transport implementation."""

    @pytest.mark.asyncio
    async def test_write_queues_event(self) -> None:
        """write() queues event without blocking."""
        transport = MockTransport()

        event = ARLSEvent(
            agentlens_version="1.0",
            schema_type=SchemaType.AGENT_START,
            timestamp="2025-01-01T00:00:00Z",
            trace_id="trace_123",
            run_id="run_123",
            step_index=0,
            agent=AgentContext(name="TestAgent", phase=AgentPhase.PLAN),
            privacy=PrivacyData(pii_detected=False),
        )

        await transport.write(event, "test_output")

        # Event should be queued
        assert not transport.queue.empty()

    @pytest.mark.asyncio
    async def test_flush_drains_queue(self) -> None:
        """flush() drains the queue."""
        transport = MockTransport()

        event = ARLSEvent(
            agentlens_version="1.0",
            schema_type=SchemaType.AGENT_START,
            timestamp="2025-01-01T00:00:00Z",
            trace_id="trace_123",
            run_id="run_123",
            step_index=0,
            agent=AgentContext(name="TestAgent", phase=AgentPhase.PLAN),
            privacy=PrivacyData(pii_detected=False),
        )

        await transport.write(event, "test_output")
        assert not transport.queue.empty()

        await transport.flush()
        assert transport.queue.empty()

    @pytest.mark.asyncio
    async def test_flush_calls_drain(self) -> None:
        """flush() calls drain for each queued event."""
        transport = MockTransport()

        events = []
        for i in range(3):
            event = ARLSEvent(
                agentlens_version="1.0",
                schema_type=SchemaType.AGENT_START,
                timestamp="2025-01-01T00:00:00Z",
                trace_id=f"trace_{i}",
                run_id=f"run_{i}",
                step_index=0,
                agent=AgentContext(name="TestAgent", phase=AgentPhase.PLAN),
                privacy=PrivacyData(pii_detected=False),
            )
            events.append(event)
            await transport.write(event, f"output_{i}")

        await transport.flush()

        # All events should be written
        assert len(transport.written_events) == 3
        assert transport.queue.empty()

    @pytest.mark.asyncio
    async def test_close_flushes_and_stops(self) -> None:
        """close() flushes queue and stops accepting new writes."""
        transport = MockTransport()

        event = ARLSEvent(
            agentlens_version="1.0",
            schema_type=SchemaType.AGENT_START,
            timestamp="2025-01-01T00:00:00Z",
            trace_id="trace_123",
            run_id="run_123",
            step_index=0,
            agent=AgentContext(name="TestAgent", phase=AgentPhase.PLAN),
            privacy=PrivacyData(pii_detected=False),
        )

        await transport.write(event, "test_output")
        await transport.close()

        # Events should be flushed
        assert transport.queue.empty()
        assert len(transport.written_events) == 1

        # No new writes should be accepted
        await transport.write(event, "new_output")
        assert len(transport.written_events) == 1

    @pytest.mark.asyncio
    async def test_queue_full_drops_oldest(self) -> None:
        """Queue dropping oldest event when full."""
        config = TransportConfig(max_queue_size=2)
        transport = MockTransport(config)

        event = ARLSEvent(
            agentlens_version="1.0",
            schema_type=SchemaType.AGENT_START,
            timestamp="2025-01-01T00:00:00Z",
            trace_id="trace_123",
            run_id="run_123",
            step_index=0,
            agent=AgentContext(name="TestAgent", phase=AgentPhase.PLAN),
            privacy=PrivacyData(pii_detected=False),
        )

        # Fill queue
        await transport.write(event, "output_1")
        await transport.write(event, "output_2")

        # This should drop oldest
        await transport.write(event, "output_3")

        await transport.flush()

        # Should have dropped one event
        assert len(transport.written_events) <= 2

    @pytest.mark.asyncio
    async def test_multiple_writes_then_flush(self) -> None:
        """Multiple writes followed by single flush."""
        transport = MockTransport()

        for i in range(10):
            event = ARLSEvent(
                agentlens_version="1.0",
                schema_type=SchemaType.AGENT_START,
                timestamp="2025-01-01T00:00:00Z",
                trace_id=f"trace_{i}",
                run_id=f"run_{i}",
                step_index=0,
                agent=AgentContext(name="TestAgent", phase=AgentPhase.PLAN),
                privacy=PrivacyData(pii_detected=False),
            )
            await transport.write(event, f"output_{i}")

        assert transport.queue.qsize() == 10

        await transport.flush()

        assert transport.queue.empty()
        assert len(transport.written_events) == 10
