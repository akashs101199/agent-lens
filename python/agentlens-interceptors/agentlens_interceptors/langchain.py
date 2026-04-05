"""
LangChain callback handler for automatic agent tracing.

Provides a LangChain BaseCallbackHandler that automatically logs agent
execution, tool calls, and LLM calls to AgentLens.
"""

from typing import Any, Dict, List, Optional

from agentlens_core import (
    AgentPhase,
    build_agent_start_event,
    build_agent_end_event,
    build_tool_event,
    build_llm_event,
    build_error_event,
    CallStatus,
    get_run_context,
    create_run_context,
    run_in_context,
    costs,
)


class AgentLensCallbackHandler:
    """
    LangChain callback handler that logs to AgentLens.

    This handler captures all LangChain events (agent start/end, tool calls,
    LLM calls, etc.) and logs them as ARLS events.

    Usage:
        >>> from langchain.agents import create_react_agent
        >>> from agentlens_interceptors.langchain import AgentLensCallbackHandler
        >>> handler = AgentLensCallbackHandler()
        >>> agent = create_react_agent(
        ...     llm=llm,
        ...     tools=tools,
        ...     callbacks=[handler]
        ... )
    """

    def __init__(self, agent_name: str = "LangChainAgent") -> None:
        """
        Initialize the callback handler.

        Args:
            agent_name: Name of the agent for logging
        """
        self.agent_name = agent_name
        self._run_context: Optional[Any] = None
        self._step_count = 0
        self._total_cost = 0.0
        self._total_tokens = 0

    def on_agent_action(
        self,
        action: Any,
        run_id: str,
        **kwargs: Any,
    ) -> None:
        """
        Called when an agent takes an action.

        Args:
            action: The action taken by the agent
            run_id: The run ID
            **kwargs: Additional arguments
        """
        # Log agent action - typically a tool call or reasoning step
        pass

    def on_agent_finish(
        self,
        finish: Any,
        run_id: str,
        **kwargs: Any,
    ) -> None:
        """
        Called when an agent finishes execution.

        Args:
            finish: The finish object containing output
            run_id: The run ID
            **kwargs: Additional arguments
        """
        # Log agent finish
        pass

    def on_llm_start(
        self,
        serialized: Dict[str, Any],
        prompts: List[str],
        run_id: str,
        **kwargs: Any,
    ) -> None:
        """
        Called when LangChain starts an LLM call.

        Args:
            serialized: Serialized LLM configuration
            prompts: List of prompt strings
            run_id: The run ID
            **kwargs: Additional arguments
        """
        # Store start time for latency calculation
        self._llm_start_time: float = __import__('time').time()
        self._current_model = serialized.get('model_name', 'unknown')

    def on_llm_end(
        self,
        response: Any,
        run_id: str,
        **kwargs: Any,
    ) -> None:
        """
        Called when LangChain receives an LLM response.

        Args:
            response: The LLM response object
            run_id: The run ID
            **kwargs: Additional arguments
        """
        import time

        # Calculate latency
        latency_ms = (time.time() - self._llm_start_time) * 1000

        # Extract token counts
        input_tokens = 0
        output_tokens = 0

        if hasattr(response, 'llm_output') and response.llm_output:
            if isinstance(response.llm_output, dict):
                token_usage = response.llm_output.get('token_usage', {})
                input_tokens = token_usage.get('prompt_tokens', 0)
                output_tokens = token_usage.get('completion_tokens', 0)

        # Calculate cost
        cost_usd = costs.calculate_cost(
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            model=self._current_model,
        )

        # Update totals
        self._total_tokens += input_tokens + output_tokens
        self._total_cost += cost_usd

        # Build and log event
        ctx = get_run_context()
        if ctx is not None:
            event = build_llm_event(
                model=self._current_model,
                provider='langchain',
                prompt_tokens=input_tokens,
                completion_tokens=output_tokens,
                cost_usd=cost_usd,
                latency_ms=latency_ms,
                finish_reason='end_turn',
            )
            self._step_count += 1

    def on_llm_error(
        self,
        error: Exception,
        run_id: str,
        **kwargs: Any,
    ) -> None:
        """
        Called when an LLM call fails.

        Args:
            error: The exception that occurred
            run_id: The run ID
            **kwargs: Additional arguments
        """
        # Log error event
        ctx = get_run_context()
        if ctx is not None:
            event = build_error_event(
                error,
                context_str="LLM call failed",
            )
            self._step_count += 1

    def on_tool_start(
        self,
        serialized: Dict[str, Any],
        input_str: str,
        run_id: str,
        **kwargs: Any,
    ) -> None:
        """
        Called when a tool is about to be called.

        Args:
            serialized: Serialized tool configuration
            input_str: Tool input as string
            run_id: The run ID
            **kwargs: Additional arguments
        """
        # Store start time for latency calculation
        self._tool_start_time: float = __import__('time').time()
        self._current_tool_name = serialized.get('name', 'unknown')

    def on_tool_end(
        self,
        output: str,
        run_id: str,
        **kwargs: Any,
    ) -> None:
        """
        Called when a tool finishes execution.

        Args:
            output: The tool output
            run_id: The run ID
            **kwargs: Additional arguments
        """
        import time

        # Calculate duration
        duration_ms = (time.time() - self._tool_start_time) * 1000

        # Build and log event
        ctx = get_run_context()
        if ctx is not None:
            event = build_tool_event(
                name=self._current_tool_name,
                input_data={},
                output_data=output,
                status=CallStatus.SUCCESS,
                duration_ms=duration_ms,
            )
            self._step_count += 1

    def on_tool_error(
        self,
        error: Exception,
        run_id: str,
        **kwargs: Any,
    ) -> None:
        """
        Called when a tool call fails.

        Args:
            error: The exception that occurred
            run_id: The run ID
            **kwargs: Additional arguments
        """
        import time

        # Calculate duration
        duration_ms = (time.time() - self._tool_start_time) * 1000

        # Build and log event
        ctx = get_run_context()
        if ctx is not None:
            event = build_tool_event(
                name=self._current_tool_name,
                input_data={},
                output_data=None,
                status=CallStatus.FAILURE,
                duration_ms=duration_ms,
                error_message=str(error),
            )
            self._step_count += 1

    def on_chain_start(
        self,
        serialized: Dict[str, Any],
        inputs: Dict[str, Any],
        run_id: str,
        **kwargs: Any,
    ) -> None:
        """
        Called when a chain starts execution.

        Args:
            serialized: Serialized chain configuration
            inputs: Chain inputs
            run_id: The run ID
            **kwargs: Additional arguments
        """
        # Initialize context if not already done
        if self._run_context is None and get_run_context() is None:
            self._run_context = create_run_context(self.agent_name)

            # Log agent start
            event = build_agent_start_event(self.agent_name)
            self._step_count = 0
            self._total_cost = 0.0
            self._total_tokens = 0

    def on_chain_end(
        self,
        outputs: Dict[str, Any],
        run_id: str,
        **kwargs: Any,
    ) -> None:
        """
        Called when a chain finishes execution.

        Args:
            outputs: Chain outputs
            run_id: The run ID
            **kwargs: Additional arguments
        """
        import time

        # Log agent end
        ctx = get_run_context() or self._run_context
        if ctx is not None:
            # Calculate duration (rough estimate)
            duration_ms = 0.0

            event = build_agent_end_event(
                name=self.agent_name,
                step_count=self._step_count,
                total_cost_usd=self._total_cost,
                total_tokens=self._total_tokens,
                duration_ms=duration_ms,
            )

    def on_chain_error(
        self,
        error: Exception,
        run_id: str,
        **kwargs: Any,
    ) -> None:
        """
        Called when a chain fails.

        Args:
            error: The exception that occurred
            run_id: The run ID
            **kwargs: Additional arguments
        """
        # Log error event
        ctx = get_run_context() or self._run_context
        if ctx is not None:
            event = build_error_event(
                error,
                context_str="Chain execution failed",
            )
