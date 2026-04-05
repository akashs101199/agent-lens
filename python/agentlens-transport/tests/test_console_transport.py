"""Tests for console transport."""

import io

import pytest

from agentlens_core import (
    ARLSEvent,
    SchemaType,
    AgentContext,
    AgentPhase,
    PrivacyData,
)
from agentlens_transport.console import ConsoleTransport


class TestConsoleTransport:
    """Test console transport."""

    @pytest.mark.asyncio
    async def test_console_writes_to_file(self) -> None:
        """Console transport writes to file."""
        output = io.StringIO()
        transport = ConsoleTransport(file=output)

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

        await transport.write(event, "test_message")
        await transport.flush()

        output_str = output.getvalue()
        assert "test_message" in output_str

    @pytest.mark.asyncio
    async def test_console_multiple_writes(self) -> None:
        """Console transport handles multiple writes."""
        output = io.StringIO()
        transport = ConsoleTransport(file=output)

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

        for i in range(5):
            await transport.write(event, f"message_{i}")

        await transport.flush()

        output_str = output.getvalue()
        for i in range(5):
            assert f"message_{i}" in output_str

    @pytest.mark.asyncio
    async def test_console_close(self) -> None:
        """Console transport closes properly."""
        output = io.StringIO()
        transport = ConsoleTransport(file=output)

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

        await transport.write(event, "message")
        await transport.close()

        output_str = output.getvalue()
        assert "message" in output_str
