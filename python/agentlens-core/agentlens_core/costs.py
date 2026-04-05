"""
LLM cost tables for various providers.

Provides per-token pricing (per 1M tokens, in USD) for Anthropic and OpenAI models.
"""

from typing import Optional

# Anthropic pricing (per 1M tokens, USD)
ANTHROPIC_COSTS = {
    "claude-opus-4": {"input": 15.00, "output": 75.00},
    "claude-opus-4-2": {"input": 15.00, "output": 75.00},
    "claude-sonnet-4": {"input": 3.00, "output": 15.00},
    "claude-sonnet-4-2": {"input": 3.00, "output": 15.00},
    "claude-sonnet-4-20250514": {"input": 3.00, "output": 15.00},
    "claude-haiku-4": {"input": 0.80, "output": 4.00},
    "claude-haiku-4-1": {"input": 0.80, "output": 4.00},
    "claude-haiku-3": {"input": 0.25, "output": 1.25},
    "claude-haiku-3-5": {"input": 0.25, "output": 1.25},
}

# OpenAI pricing (per 1M tokens, USD)
OPENAI_COSTS = {
    "gpt-4o": {"input": 2.50, "output": 10.00},
    "gpt-4o-2024-05-13": {"input": 2.50, "output": 10.00},
    "gpt-4o-mini": {"input": 0.15, "output": 0.60},
    "gpt-4o-mini-2024-07-18": {"input": 0.15, "output": 0.60},
    "gpt-4-turbo": {"input": 10.00, "output": 30.00},
    "gpt-4-turbo-2024-04-09": {"input": 10.00, "output": 30.00},
    "o1": {"input": 15.00, "output": 60.00},
    "o1-mini": {"input": 3.00, "output": 12.00},
}

# Google pricing (per 1M tokens, USD)
GOOGLE_COSTS = {
    "gemini-1.5-pro": {"input": 1.25, "output": 5.00},
    "gemini-1.5-flash": {"input": 0.075, "output": 0.30},
    "gemini-pro": {"input": 0.5, "output": 1.50},
    "gemini-pro-vision": {"input": 0.5, "output": 1.50},
}


def calculate_cost(
    input_tokens: int,
    output_tokens: int,
    model: str,
) -> float:
    """
    Calculate the USD cost of an LLM call.

    Looks up the model in the cost tables and computes:
    (input_tokens / 1M) * input_price + (output_tokens / 1M) * output_price

    Args:
        input_tokens: Number of input tokens
        output_tokens: Number of output tokens
        model: Model identifier (e.g., 'gpt-4o', 'claude-sonnet-4-20250514')

    Returns:
        Estimated cost in USD (float). Returns 0.0 if model not in cost tables.

    Example:
        >>> cost = calculate_cost(1200, 340, 'claude-sonnet-4-20250514')
        >>> print(f"${cost:.4f}")
        $0.0048
    """
    # Check all cost tables
    for costs_dict in [ANTHROPIC_COSTS, OPENAI_COSTS, GOOGLE_COSTS]:
        # Try exact match first
        if model in costs_dict:
            prices = costs_dict[model]
            input_cost = (input_tokens / 1_000_000) * prices["input"]
            output_cost = (output_tokens / 1_000_000) * prices["output"]
            return input_cost + output_cost

        # Try prefix match for versioned models
        for model_key in costs_dict.keys():
            if model.startswith(model_key):
                prices = costs_dict[model_key]
                input_cost = (input_tokens / 1_000_000) * prices["input"]
                output_cost = (output_tokens / 1_000_000) * prices["output"]
                return input_cost + output_cost

    # Unknown model - return 0.0
    return 0.0


def get_model_prices(model: str) -> Optional[dict[str, float]]:
    """
    Get the input and output prices for a model.

    Args:
        model: Model identifier

    Returns:
        Dict with 'input' and 'output' keys (per 1M tokens), or None if not found
    """
    for costs_dict in [ANTHROPIC_COSTS, OPENAI_COSTS, GOOGLE_COSTS]:
        if model in costs_dict:
            return costs_dict[model]

        for model_key in costs_dict.keys():
            if model.startswith(model_key):
                return costs_dict[model_key]

    return None
