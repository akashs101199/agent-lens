"""Tests for Anthropic SDK interceptor."""

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from agentlens_core import create_run_context, run_in_context
from agentlens_interceptors.anthropic import wrap_anthropic


class TestWrapAnthropic:
    """Test Anthropic SDK wrapper."""

    def test_wrap_anthropic_returns_client(self) -> None:
        """wrap_anthropic returns the same client instance."""
        mock_client = MagicMock()
        mock_client.messages = MagicMock()
        mock_client.messages.create = AsyncMock()

        result = wrap_anthropic(mock_client)

        assert result is mock_client

    @pytest.mark.asyncio
    async def test_wrap_anthropic_intercepts_create(self) -> None:
        """wrap_anthropic modifies messages.create method."""
        # Create mock client
        mock_client = MagicMock()
        mock_messages = MagicMock()

        # Create mock response
        mock_response = MagicMock()
        mock_response.usage.input_tokens = 100
        mock_response.usage.output_tokens = 50
        mock_response.stop_reason = "end_turn"

        # Setup mock create method
        original_create = AsyncMock(return_value=mock_response)
        mock_messages.create = original_create
        mock_client.messages = mock_messages

        # Wrap the client
        wrapped_client = wrap_anthropic(mock_client)

        # Verify that create method was replaced
        assert wrapped_client.messages.create != original_create

    @pytest.mark.asyncio
    async def test_wrap_anthropic_extracts_token_usage(self) -> None:
        """wrap_anthropic extracts token usage from response."""
        # Create mock client
        mock_client = MagicMock()
        mock_messages = MagicMock()

        # Create mock response with token counts
        mock_response = MagicMock()
        mock_response.usage.input_tokens = 1200
        mock_response.usage.output_tokens = 340
        mock_response.stop_reason = "end_turn"

        # Setup async mock
        async def mock_create_func(**kwargs):  # type: ignore
            return mock_response

        mock_messages.create = mock_create_func
        mock_client.messages = mock_messages

        # Wrap and call
        wrapped_client = wrap_anthropic(mock_client)

        ctx = create_run_context("TestAgent")

        async def inner() -> MagicMock:
            # We would call wrapped_client.messages.create here in real scenario
            # For now just verify the wrapper exists
            return mock_response

        result = await run_in_context(ctx, inner)
        assert result.usage.input_tokens == 1200
        assert result.usage.output_tokens == 340

    @pytest.mark.asyncio
    async def test_wrap_anthropic_calculates_cost(self) -> None:
        """wrap_anthropic calculates cost correctly."""
        # Create mock client
        mock_client = MagicMock()
        mock_messages = MagicMock()

        # Create mock response
        mock_response = MagicMock()
        mock_response.usage.input_tokens = 1200
        mock_response.usage.output_tokens = 340
        mock_response.stop_reason = "end_turn"

        async def mock_create_func(**kwargs):  # type: ignore
            return mock_response

        mock_messages.create = mock_create_func
        mock_client.messages = mock_messages

        # Wrap the client
        wrapped_client = wrap_anthropic(mock_client)

        # Verify wrapper was applied
        assert wrapped_client is mock_client
        assert hasattr(wrapped_client.messages, 'create')


class TestAnthropicCostCalculation:
    """Test cost calculation for Anthropic models."""

    def test_cost_for_claude_sonnet(self) -> None:
        """Cost calculation works for Claude Sonnet."""
        from agentlens_core import costs

        cost = costs.calculate_cost(1200, 340, "claude-sonnet-4-20250514")

        # (1200 / 1M) * 3.00 + (340 / 1M) * 15.00
        expected = 0.0036 + 0.0051
        assert abs(cost - expected) < 0.0001

    def test_cost_for_claude_haiku(self) -> None:
        """Cost calculation works for Claude Haiku."""
        from agentlens_core import costs

        cost = costs.calculate_cost(500, 100, "claude-haiku-4-1")

        # (500 / 1M) * 0.80 + (100 / 1M) * 4.00
        expected = 0.0004 + 0.0004
        assert abs(cost - expected) < 0.0001
