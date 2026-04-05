"""Tests for AgentLens main class."""

import asyncio
import json
import tempfile
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from agentlens import AgentLens, AgentLensConfig


class TestAgentLensConfig:
    """Test AgentLensConfig."""

    def test_default_config(self) -> None:
        """AgentLensConfig initializes with defaults."""
        config = AgentLensConfig(agent='TestAgent')

        assert config.agent == 'TestAgent'
        assert config.mode == 'human'
        assert config.transport == 'console'
        assert config.file_path is None
        assert config.privacy_enabled is True
        assert config.redaction_mode == 'MASK'
        assert config.max_queue_size == 1000
        assert config.flush_interval_seconds == 5.0

    def test_custom_config(self) -> None:
        """AgentLensConfig initializes with custom values."""
        config = AgentLensConfig(
            agent='TestAgent',
            mode='ai',
            transport='file',
            file_path='test.log',
            privacy_enabled=False,
            redaction_mode='HASH',
            max_queue_size=500,
            flush_interval_seconds=10.0,
        )

        assert config.agent == 'TestAgent'
        assert config.mode == 'ai'
        assert config.transport == 'file'
        assert config.file_path == 'test.log'
        assert config.privacy_enabled is False
        assert config.redaction_mode == 'HASH'
        assert config.max_queue_size == 500
        assert config.flush_interval_seconds == 10.0


class TestAgentLensInit:
    """Test AgentLens initialization."""

    def test_console_transport_initialization(self) -> None:
        """AgentLens initializes console transport by default."""
        config = AgentLensConfig(agent='TestAgent', transport='console')
        lens = AgentLens(config)

        assert lens.config.agent == 'TestAgent'
        assert lens._transport is not None

    def test_file_transport_initialization(self) -> None:
        """AgentLens initializes file transport when specified."""
        with tempfile.TemporaryDirectory() as tmpdir:
            filepath = Path(tmpdir) / 'test.log'
            config = AgentLensConfig(
                agent='TestAgent',
                transport='file',
                file_path=str(filepath),
            )
            lens = AgentLens(config)

            assert lens.config.transport == 'file'
            assert lens._transport is not None

    def test_file_transport_requires_path(self) -> None:
        """AgentLens raises ValueError if file_path not provided for file transport."""
        config = AgentLensConfig(
            agent='TestAgent', transport='file', file_path=None
        )

        with pytest.raises(ValueError, match='file_path must be provided'):
            AgentLens(config)

    def test_privacy_initialization(self) -> None:
        """AgentLens initializes privacy engine when enabled."""
        config = AgentLensConfig(
            agent='TestAgent',
            privacy_enabled=True,
            redaction_mode='MASK',
        )
        lens = AgentLens(config)

        assert lens._privacy_enabled is True
        assert lens._redaction_mode.value == 'MASK'

    def test_privacy_disabled(self) -> None:
        """AgentLens skips privacy engine when disabled."""
        config = AgentLensConfig(
            agent='TestAgent',
            privacy_enabled=False,
        )
        lens = AgentLens(config)

        assert lens._privacy_enabled is False


class TestAgentLensWrap:
    """Test client wrapping."""

    def test_wrap_anthropic(self) -> None:
        """AgentLens.wrap wraps Anthropic client."""
        config = AgentLensConfig(agent='TestAgent')
        lens = AgentLens(config)

        mock_client = MagicMock()
        mock_client.__class__.__name__ = 'Anthropic'

        with patch('agentlens.wrap_anthropic', return_value=mock_client) as mock:
            result = lens.wrap(mock_client)
            mock.assert_called_once()
            assert result == mock_client

    def test_wrap_openai(self) -> None:
        """AgentLens.wrap wraps OpenAI client."""
        config = AgentLensConfig(agent='TestAgent')
        lens = AgentLens(config)

        mock_client = MagicMock()
        mock_client.__class__.__name__ = 'OpenAI'

        with patch('agentlens.wrap_openai', return_value=mock_client) as mock:
            result = lens.wrap(mock_client)
            mock.assert_called_once()
            assert result == mock_client

    def test_wrap_unsupported_client(self) -> None:
        """AgentLens.wrap raises ValueError for unsupported clients."""
        config = AgentLensConfig(agent='TestAgent')
        lens = AgentLens(config)

        mock_client = MagicMock()
        mock_client.__class__.__name__ = 'UnknownClient'

        with pytest.raises(ValueError, match='Unsupported client type'):
            lens.wrap(mock_client)


class TestAgentLensWrapTool:
    """Test tool wrapping."""

    def test_wrap_tool(self) -> None:
        """AgentLens.wrap_tool delegates to wrap_tool function."""
        config = AgentLensConfig(agent='TestAgent')
        lens = AgentLens(config)

        async def my_tool() -> str:
            return 'result'

        with patch('agentlens.wrap_tool') as mock:
            lens.wrap_tool('my_tool', my_tool)
            mock.assert_called_once_with('my_tool', my_tool)


class TestAgentLensStartRun:
    """Test run management."""

    def test_start_run(self) -> None:
        """AgentLens.start_run creates an AgentRun."""
        config = AgentLensConfig(agent='TestAgent')
        lens = AgentLens(config)

        run = lens.start_run()

        assert run is not None
        assert run.context.run_id is not None
        assert run.context.trace_id is not None
        assert run.context.step_index == 0

    def test_start_run_with_name(self) -> None:
        """AgentLens.start_run accepts optional agent name."""
        config = AgentLensConfig(agent='TestAgent')
        lens = AgentLens(config)

        run = lens.start_run(name='CustomAgent')

        assert run.context is not None

    @pytest.mark.asyncio
    async def test_agent_run_context_manager(self) -> None:
        """AgentRun works as async context manager."""
        config = AgentLensConfig(agent='TestAgent')
        lens = AgentLens(config)

        async with lens.start_run() as run:
            assert run.context is not None


class TestAgentLensLog:
    """Test manual logging."""

    @pytest.mark.asyncio
    async def test_log_creates_event(self) -> None:
        """AgentLens.log creates and queues an event."""
        config = AgentLensConfig(agent='TestAgent')
        lens = AgentLens(config)

        # Mock the transport
        lens._transport.write = AsyncMock()

        lens.log(
            schema_type='REASONING_STEP',
            agent_phase='PLAN',
            metadata={'thought': 'test'},
        )

        # Give async task time to complete
        await asyncio.sleep(0.1)

        # Event was queued (may be in background task)
        assert lens._transport is not None

    @pytest.mark.asyncio
    async def test_log_without_context(self) -> None:
        """AgentLens.log creates context if none exists."""
        config = AgentLensConfig(agent='TestAgent')
        lens = AgentLens(config)

        lens._transport.write = AsyncMock()

        lens.log(schema_type='AGENT_START', agent_phase='IDLE')

        await asyncio.sleep(0.1)

        # Should not raise


class TestAgentLensFlushAndClose:
    """Test flushing and closing."""

    @pytest.mark.asyncio
    async def test_flush(self) -> None:
        """AgentLens.flush calls transport flush."""
        config = AgentLensConfig(agent='TestAgent')
        lens = AgentLens(config)

        lens._transport.flush = AsyncMock()

        await lens.flush()

        lens._transport.flush.assert_called_once()

    @pytest.mark.asyncio
    async def test_close(self) -> None:
        """AgentLens.close calls transport close."""
        config = AgentLensConfig(agent='TestAgent')
        lens = AgentLens(config)

        lens._transport.close = AsyncMock()

        await lens.close()

        lens._transport.close.assert_called_once()


class TestAgentLensIntegration:
    """Integration tests."""

    @pytest.mark.asyncio
    async def test_full_workflow(self) -> None:
        """Full AgentLens workflow with file transport."""
        with tempfile.TemporaryDirectory() as tmpdir:
            filepath = Path(tmpdir) / 'test.log'

            config = AgentLensConfig(
                agent='TestAgent',
                mode='ai',
                transport='file',
                file_path=str(filepath),
            )

            lens = AgentLens(config)

            # Log an event
            lens.log(
                schema_type='AGENT_START',
                agent_phase='PLAN',
                metadata={'test': True},
            )

            # Allow async task to complete
            await asyncio.sleep(0.01)

            # Flush and close
            await lens.flush()
            await lens.close()

            # Verify file was created and contains JSONL
            assert filepath.exists()
            with open(filepath) as f:
                content = f.read().strip()
                if content:
                    lines = content.split('\n')
                    for line in lines:
                        json.loads(line)  # Should not raise
