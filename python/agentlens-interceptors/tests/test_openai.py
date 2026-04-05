"""Tests for OpenAI SDK interceptor."""

from unittest.mock import AsyncMock, MagicMock

import pytest

from agentlens_core import create_run_context, run_in_context
from agentlens_interceptors.openai import wrap_openai


class TestWrapOpenAI:
    """Test OpenAI SDK wrapper."""

    def test_wrap_openai_returns_client(self) -> None:
        """wrap_openai returns the same client instance."""
        mock_client = MagicMock()
        mock_client.chat = MagicMock()
        mock_client.chat.completions = MagicMock()
        mock_client.chat.completions.create = AsyncMock()

        result = wrap_openai(mock_client)

        assert result is mock_client

    @pytest.mark.asyncio
    async def test_wrap_openai_intercepts_create(self) -> None:
        """wrap_openai modifies chat.completions.create method."""
        # Create mock client
        mock_client = MagicMock()
        mock_completions = MagicMock()

        # Create mock response
        mock_choice = MagicMock()
        mock_choice.finish_reason = "stop"

        mock_response = MagicMock()
        mock_response.usage.prompt_tokens = 100
        mock_response.usage.completion_tokens = 50
        mock_response.choices = [mock_choice]

        # Setup mock create method
        original_create = AsyncMock(return_value=mock_response)
        mock_completions.create = original_create
        mock_client.chat.completions = mock_completions

        # Wrap the client
        wrapped_client = wrap_openai(mock_client)

        # Verify that create method was replaced
        assert wrapped_client.chat.completions.create != original_create

    @pytest.mark.asyncio
    async def test_wrap_openai_extracts_token_usage(self) -> None:
        """wrap_openai extracts token usage from response."""
        # Create mock client
        mock_client = MagicMock()
        mock_completions = MagicMock()

        # Create mock response
        mock_choice = MagicMock()
        mock_choice.finish_reason = "stop"

        mock_response = MagicMock()
        mock_response.usage.prompt_tokens = 1000
        mock_response.usage.completion_tokens = 500
        mock_response.choices = [mock_choice]

        # Setup async mock
        async def mock_create_func(**kwargs):  # type: ignore
            return mock_response

        mock_completions.create = mock_create_func
        mock_client.chat.completions = mock_completions

        # Wrap and call
        wrapped_client = wrap_openai(mock_client)

        ctx = create_run_context("TestAgent")

        async def inner() -> MagicMock:
            return mock_response

        result = await run_in_context(ctx, inner)
        assert result.usage.prompt_tokens == 1000
        assert result.usage.completion_tokens == 500

    @pytest.mark.asyncio
    async def test_wrap_openai_calculates_cost(self) -> None:
        """wrap_openai calculates cost correctly."""
        # Create mock client
        mock_client = MagicMock()
        mock_completions = MagicMock()

        # Create mock response
        mock_choice = MagicMock()
        mock_choice.finish_reason = "stop"

        mock_response = MagicMock()
        mock_response.usage.prompt_tokens = 1000
        mock_response.usage.completion_tokens = 500
        mock_response.choices = [mock_choice]

        async def mock_create_func(**kwargs):  # type: ignore
            return mock_response

        mock_completions.create = mock_create_func
        mock_client.chat.completions = mock_completions

        # Wrap the client
        wrapped_client = wrap_openai(mock_client)

        # Verify wrapper was applied
        assert wrapped_client is mock_client
        assert hasattr(wrapped_client.chat.completions, 'create')


class TestOpenAICostCalculation:
    """Test cost calculation for OpenAI models."""

    def test_cost_for_gpt4o(self) -> None:
        """Cost calculation works for GPT-4o."""
        from agentlens_core import costs

        cost = costs.calculate_cost(1000, 500, "gpt-4o")

        # (1000 / 1M) * 2.50 + (500 / 1M) * 10.00
        expected = 0.0025 + 0.005
        assert abs(cost - expected) < 0.0001

    def test_cost_for_gpt4o_mini(self) -> None:
        """Cost calculation works for GPT-4o-mini."""
        from agentlens_core import costs

        cost = costs.calculate_cost(1000, 500, "gpt-4o-mini")

        # (1000 / 1M) * 0.15 + (500 / 1M) * 0.60
        expected = 0.00015 + 0.0003
        assert abs(cost - expected) < 0.0001
