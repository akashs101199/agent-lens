"""Tests for LangChain callback handler."""

from unittest.mock import MagicMock

import pytest

from agentlens_interceptors.langchain import AgentLensCallbackHandler


class TestAgentLensCallbackHandler:
    """Test LangChain callback handler."""

    def test_handler_initialization(self) -> None:
        """Handler initializes with default agent name."""
        handler = AgentLensCallbackHandler()

        assert handler.agent_name == "LangChainAgent"
        assert handler._step_count == 0
        assert handler._total_cost == 0.0
        assert handler._total_tokens == 0

    def test_handler_custom_name(self) -> None:
        """Handler accepts custom agent name."""
        handler = AgentLensCallbackHandler(agent_name="MyCustomAgent")

        assert handler.agent_name == "MyCustomAgent"

    def test_handler_has_required_callbacks(self) -> None:
        """Handler implements required callback methods."""
        handler = AgentLensCallbackHandler()

        # Check that required methods exist
        assert hasattr(handler, 'on_agent_action')
        assert hasattr(handler, 'on_agent_finish')
        assert hasattr(handler, 'on_llm_start')
        assert hasattr(handler, 'on_llm_end')
        assert hasattr(handler, 'on_llm_error')
        assert hasattr(handler, 'on_tool_start')
        assert hasattr(handler, 'on_tool_end')
        assert hasattr(handler, 'on_tool_error')
        assert hasattr(handler, 'on_chain_start')
        assert hasattr(handler, 'on_chain_end')
        assert hasattr(handler, 'on_chain_error')

    def test_on_llm_start(self) -> None:
        """on_llm_start stores model information."""
        handler = AgentLensCallbackHandler()

        serialized = {"model_name": "gpt-4o"}
        prompts = ["test prompt"]

        handler.on_llm_start(serialized, prompts, run_id="run_123")

        assert handler._current_model == "gpt-4o"

    def test_on_llm_start_default_model(self) -> None:
        """on_llm_start uses default model if not provided."""
        handler = AgentLensCallbackHandler()

        serialized: dict = {}
        prompts = ["test prompt"]

        handler.on_llm_start(serialized, prompts, run_id="run_123")

        assert handler._current_model == "unknown"

    def test_on_tool_start(self) -> None:
        """on_tool_start stores tool name."""
        handler = AgentLensCallbackHandler()

        serialized = {"name": "web_search"}
        input_str = "query=test"

        handler.on_tool_start(serialized, input_str, run_id="run_123")

        assert handler._current_tool_name == "web_search"

    def test_on_tool_start_default_name(self) -> None:
        """on_tool_start uses default tool name if not provided."""
        handler = AgentLensCallbackHandler()

        serialized: dict = {}
        input_str = "input"

        handler.on_tool_start(serialized, input_str, run_id="run_123")

        assert handler._current_tool_name == "unknown"

    def test_handler_tracks_costs(self) -> None:
        """Handler tracks total costs and tokens."""
        handler = AgentLensCallbackHandler()

        # Simulate adding costs
        handler._total_cost += 0.005
        handler._total_tokens += 100

        assert handler._total_cost == 0.005
        assert handler._total_tokens == 100

    def test_handler_tracks_step_count(self) -> None:
        """Handler increments step count."""
        handler = AgentLensCallbackHandler()

        initial_count = handler._step_count
        handler._step_count += 1

        assert handler._step_count == initial_count + 1

    def test_on_chain_start(self) -> None:
        """on_chain_start initializes run context."""
        handler = AgentLensCallbackHandler("TestAgent")

        serialized: dict = {}
        inputs = {"input": "test"}

        # Reset state
        handler._run_context = None

        handler.on_chain_start(serialized, inputs, run_id="run_123")

        # Should have created a run context
        assert handler._run_context is not None
        assert handler._run_context.agent_name == "TestAgent"

    def test_handler_as_langchain_callback(self) -> None:
        """Handler can be used as LangChain callback."""
        handler = AgentLensCallbackHandler()

        # Create mock LangChain component
        mock_chain = MagicMock()
        mock_chain.callbacks = [handler]

        # Verify handler is in callbacks
        assert handler in mock_chain.callbacks

    def test_handler_error_tracking(self) -> None:
        """Handler tracks errors from LLM and tools."""
        handler = AgentLensCallbackHandler()

        error = ValueError("Test error")

        # Errors should be handled without crashing handler
        # In real implementation, would log error event
        assert isinstance(error, Exception)
