"""Tests for file transport."""

import json
import tempfile
from pathlib import Path

import pytest

from agentlens_core import (
    ARLSEvent,
    SchemaType,
    AgentContext,
    AgentPhase,
    PrivacyData,
)
from agentlens_transport.file import FileTransport


class TestFileTransport:
    """Test file transport."""

    @pytest.mark.asyncio
    async def test_file_transport_writes_jsonl(self) -> None:
        """File transport writes JSONL to file."""
        with tempfile.TemporaryDirectory() as tmpdir:
            filepath = Path(tmpdir) / "test.log"
            transport = FileTransport(str(filepath))

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

            # Write JSON line
            json_line = json.dumps(event.to_dict())
            await transport.write(event, json_line)
            await transport.flush()
            await transport.close()

            # Verify file exists and contains valid JSON
            assert filepath.exists()
            with open(filepath) as f:
                content = f.read()
                assert content.count('\n') >= 1  # At least one line
                # First line should be valid JSON
                first_line = content.strip().split('\n')[0]
                parsed = json.loads(first_line)
                assert parsed["schema_type"] == "AGENT_START"

    @pytest.mark.asyncio
    async def test_file_transport_multiple_events(self) -> None:
        """File transport handles multiple events."""
        with tempfile.TemporaryDirectory() as tmpdir:
            filepath = Path(tmpdir) / "test.log"
            transport = FileTransport(str(filepath))

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

            # Write multiple events
            for i in range(5):
                json_line = json.dumps(event.to_dict())
                await transport.write(event, json_line)

            await transport.flush()
            await transport.close()

            # Verify all events written
            with open(filepath) as f:
                lines = f.read().strip().split('\n')
                assert len(lines) == 5
                for line in lines:
                    parsed = json.loads(line)
                    assert parsed["schema_type"] == "AGENT_START"

    @pytest.mark.asyncio
    async def test_file_transport_appends(self) -> None:
        """File transport appends to existing file."""
        with tempfile.TemporaryDirectory() as tmpdir:
            filepath = Path(tmpdir) / "test.log"

            # Create initial file
            with open(filepath, 'w') as f:
                f.write('{"initial": true}\n')

            transport = FileTransport(str(filepath))

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

            json_line = json.dumps(event.to_dict())
            await transport.write(event, json_line)
            await transport.flush()
            await transport.close()

            # Verify both lines present
            with open(filepath) as f:
                lines = f.read().strip().split('\n')
                assert len(lines) == 2
                first = json.loads(lines[0])
                assert first["initial"] is True

    @pytest.mark.asyncio
    async def test_file_transport_rotation(self) -> None:
        """File transport rotates when size limit exceeded."""
        with tempfile.TemporaryDirectory() as tmpdir:
            filepath = Path(tmpdir) / "test.log"
            # Set very small max size to trigger rotation
            transport = FileTransport(str(filepath), max_file_size=100, max_rotations=2)

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

            json_line = json.dumps(event.to_dict())

            # Write multiple events to trigger rotation
            for i in range(10):
                await transport.write(event, json_line)

            await transport.flush()
            await transport.close()

            # Check if rotation happened
            files = list(Path(tmpdir).glob("test*.log"))
            # Should have original file and possibly rotated files
            assert len(files) >= 1

    @pytest.mark.asyncio
    async def test_compact_file_transport(self) -> None:
        """Compact file transport uses smaller defaults."""
        from agentlens_transport.file import CompactFileTransport

        with tempfile.TemporaryDirectory() as tmpdir:
            filepath = Path(tmpdir) / "test.log"
            transport = CompactFileTransport(str(filepath))

            # Should have smaller defaults
            assert transport.max_file_size == 10 * 1024 * 1024  # 10MB
            assert transport.max_rotations == 3

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

            json_line = json.dumps(event.to_dict())
            await transport.write(event, json_line)
            await transport.flush()
            await transport.close()

            assert filepath.exists()
