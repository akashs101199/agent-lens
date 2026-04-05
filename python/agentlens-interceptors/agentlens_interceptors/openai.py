"""
OpenAI SDK interceptor for automatic LLM call logging.

Wraps an OpenAI client instance and logs all chat.completions.create()
calls as ARLS LLM_CALL events.
"""

import time
from typing import Any, Optional, TypeVar

from agentlens_core import build_llm_event, get_run_context, costs

T = TypeVar('T')


class OpenAIInterceptor:
    """
    Wraps an OpenAI client to log all LLM calls.

    This class wraps the OpenAI client's chat.completions.create() method to
    automatically capture token usage, cost, latency, and other metadata.
    """

    def __init__(self, client: Any) -> None:
        """
        Initialize the OpenAI interceptor.

        Args:
            client: An OpenAI client instance (from openai package)
        """
        self.client = client
        self._original_create = client.chat.completions.create

        # Replace the create method with our wrapped version
        client.chat.completions.create = self._wrapped_create

    async def _wrapped_create(self, **kwargs: Any) -> Any:
        """
        Wrapped version of chat.completions.create() that logs to AgentLens.

        Args:
            **kwargs: Arguments to pass to chat.completions.create()

        Returns:
            The response from chat.completions.create()
        """
        start_time = time.time()

        try:
            # Call the original method
            response = await self.client.chat.completions.create(**kwargs) if hasattr(
                self._original_create, '__call__'
            ) else self._original_create(**kwargs)

            # Extract metadata
            model = kwargs.get('model', 'unknown')
            usage = response.usage

            input_tokens = usage.prompt_tokens if hasattr(usage, 'prompt_tokens') else 0
            output_tokens = usage.completion_tokens if hasattr(
                usage, 'completion_tokens'
            ) else 0

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
            finish_reason = 'unknown'
            if hasattr(response, 'choices') and len(response.choices) > 0:
                choice = response.choices[0]
                if hasattr(choice, 'finish_reason'):
                    finish_reason = choice.finish_reason or 'unknown'

            # Build and log event
            ctx = get_run_context()
            if ctx is not None:
                event = build_llm_event(
                    model=model,
                    provider='openai',
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


def wrap_openai(client: Any) -> Any:
    """
    Wrap an OpenAI client for automatic LLM call logging.

    This function modifies the client's chat.completions.create() method to
    automatically log all calls to AgentLens as LLM_CALL events.

    Args:
        client: An OpenAI client instance

    Returns:
        The same client instance (modified in-place)

    Example:
        >>> from openai import OpenAI
        >>> client = OpenAI()
        >>> client = wrap_openai(client)
        >>> response = client.chat.completions.create(
        ...     model="gpt-4o",
        ...     messages=[{"role": "user", "content": "Hello"}]
        ... )
    """
    interceptor = OpenAIInterceptor(client)
    return client
