"""Tests for LLM cost calculation."""

import pytest

from agentlens_core.costs import calculate_cost, get_model_prices


class TestCalculateCost:
    """Test cost calculation for various models."""

    def test_anthropic_sonnet_cost(self) -> None:
        """Calculate cost for Claude Sonnet model."""
        cost = calculate_cost(
            input_tokens=1200,
            output_tokens=340,
            model="claude-sonnet-4-20250514",
        )

        # (1200 / 1M) * 3.00 + (340 / 1M) * 15.00
        # = 0.0036 + 0.0051 = 0.0087
        expected = 0.0036 + 0.0051
        assert abs(cost - expected) < 0.0001

    def test_anthropic_haiku_cost(self) -> None:
        """Calculate cost for Claude Haiku model."""
        cost = calculate_cost(
            input_tokens=500,
            output_tokens=100,
            model="claude-haiku-4-1",
        )

        # (500 / 1M) * 0.80 + (100 / 1M) * 4.00
        # = 0.0004 + 0.0004 = 0.0008
        expected = 0.0004 + 0.0004
        assert abs(cost - expected) < 0.0001

    def test_openai_gpt4o_cost(self) -> None:
        """Calculate cost for GPT-4o model."""
        cost = calculate_cost(
            input_tokens=1000,
            output_tokens=500,
            model="gpt-4o",
        )

        # (1000 / 1M) * 2.50 + (500 / 1M) * 10.00
        # = 0.0025 + 0.005 = 0.0075
        expected = 0.0025 + 0.005
        assert abs(cost - expected) < 0.0001

    def test_openai_gpt4o_mini_cost(self) -> None:
        """Calculate cost for GPT-4o-mini model."""
        cost = calculate_cost(
            input_tokens=1000,
            output_tokens=500,
            model="gpt-4o-mini-2024-07-18",
        )

        # (1000 / 1M) * 0.15 + (500 / 1M) * 0.60
        # = 0.00015 + 0.0003 = 0.00045
        expected = 0.00015 + 0.0003
        assert abs(cost - expected) < 0.0001

    def test_unknown_model_returns_zero(self) -> None:
        """Unknown model returns 0.0 cost."""
        cost = calculate_cost(
            input_tokens=1000,
            output_tokens=500,
            model="unknown-model-xyz",
        )
        assert cost == 0.0

    def test_zero_tokens_returns_zero(self) -> None:
        """Zero tokens returns zero cost."""
        cost = calculate_cost(
            input_tokens=0,
            output_tokens=0,
            model="claude-sonnet-4-20250514",
        )
        assert cost == 0.0

    def test_prefix_matching_works(self) -> None:
        """Prefix matching works for versioned models."""
        cost1 = calculate_cost(100, 50, "gpt-4o")
        cost2 = calculate_cost(100, 50, "gpt-4o-2024-05-13")
        assert cost1 == cost2


class TestGetModelPrices:
    """Test model price lookup."""

    def test_get_anthropic_prices(self) -> None:
        """Get prices for Anthropic model."""
        prices = get_model_prices("claude-sonnet-4-20250514")
        assert prices is not None
        assert prices["input"] == 3.00
        assert prices["output"] == 15.00

    def test_get_openai_prices(self) -> None:
        """Get prices for OpenAI model."""
        prices = get_model_prices("gpt-4o")
        assert prices is not None
        assert prices["input"] == 2.50
        assert prices["output"] == 10.00

    def test_get_unknown_model_prices(self) -> None:
        """Unknown model returns None."""
        prices = get_model_prices("unknown-model")
        assert prices is None

    def test_get_prices_with_prefix_match(self) -> None:
        """Get prices with prefix matching."""
        prices1 = get_model_prices("gpt-4o")
        prices2 = get_model_prices("gpt-4o-2024-05-13")
        assert prices1 == prices2
