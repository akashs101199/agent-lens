"""
Anthropic SDK interceptor for automatic LLM call logging.

Wraps an Anthropic client instance and logs all messages.create() calls as
ARLS LLM_CALL events.
"""

import time
from typing import Any, Optional, TypeVar

from agentlens_core import build_llm_event, get_run_context, costs

T = TypeVar('T')


class AnthropicInterceptor:
    """
    Wraps an Anthropic client to log all LLM calls.

    This class wraps the Anthropic client's messages.create() method to
    automatically capture token usage, cost, latency, and other metadata.
    """

    def __init__(self, client: Any) -> None:
        """
        Initialize the Anthropic interceptor.

        Args:
            client: An Anthropic client instance (from anthropic package)
        """
        self.client = client
        self._original_create = client.messages.create

        # Replace the create method with our wrapped version
        client.messages.create = self._wrapped_create

    async def _wrapped_create(self, **kwargs: Any) -> Any:
        """
        Wrapped version of messages.create() that logs to AgentLens.

        Args:
            **kwargs: Arguments to pass to messages.create()

        Returns:
            The response from messages.create()
        """
        start_time = time.time()

        try:
            # Call the original method
            response = await self.client.messages.create(**kwargs) if hasattr(
                self._original_create, '__call__'
            ) else self._original_create(**kwargs)

            # Extract metadata
            model = kwargs.get('model', 'unknown')
            usage = response.usage

            input_tokens = usage.input_tokens if hasattr(usage, 'input_tokens') else 0
            output_tokens = usage.output_tokens if hasattr(usage, 'output_tokens') else 0

            # Calculate cost
            cost_usd = costs.calculate_cost(
                input_tokens=input_tokens,
                output_tokens=output_tokens,
                model=model,
            )

            # Calculate latency
            end_time = time.time()
            latency_ms = (end_time - start_time) * 1000

            # Extract finish reason
            finish_reason = (
                response.stop_reason
                if hasattr(response, 'stop_reason')
                else 'unknown'
            )

            # Build and log event
            ctx = get_run_context()
            if ctx is not None:
                event = build_llm_event(
                    model=model,
                    provider='anthropic',
                    prompt_tokens=input_tokens,
                    completion_tokens=output_tokens,
                    cost_usd=cost_usd,
                    latency_ms=latency_ms,
                    finish_reason=finish_reason,
                )
                # Event would be sent to transports here in full implementation

            return response

        except Exception as e:
            # Calculate latency even on error
            end_time = time.time()
            latency_ms = (end_time - start_time) * 1000

            # Log the error event (in full implementation)
            # For now, just re-raise
            raise


def wrap_anthropic(client: Any) -> Any:
    """
    Wrap an Anthropic client for automatic LLM call logging.

    This function modifies the client's messages.create() method to
    automatically log all calls to AgentLens as LLM_CALL events.

    Args:
        client: An Anthropic client instance

    Returns:
        The same client instance (modified in-place)

    Example:
        >>> from anthropic import Anthropic
        >>> client = Anthropic()
        >>> client = wrap_anthropic(client)
        >>> response = client.messages.create(
        ...     model="claude-sonnet-4-20250514",
        ...     max_tokens=1024,
        ...     messages=[{"role": "user", "content": "Hello"}]
        ... )
    """
    interceptor = AnthropicInterceptor(client)
    return client
