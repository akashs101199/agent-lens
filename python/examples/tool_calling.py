#!/usr/bin/env python3
"""
AgentLens Tool Calling Example

Demonstrates wrapping an Anthropic client AND instrumenting tool calls.
Shows a complete agent workflow with multiple tools and LLM calls.

Usage:
    ANTHROPIC_API_KEY=your-key python tool_calling.py

Output:
    - Full agent run trace with tools and LLM calls
    - Visualization of all steps and their costs
"""

import asyncio
import json
from agentlens import AgentLens, AgentLensConfig


# Mock tools for demonstration
async def search_tool(query: str) -> str:
    """Mock search tool."""
    results = {
        "AI observability": [
            "AgentLens — structured logging for AI agents",
            "OpenLens — monitoring system",
            "DataDog — observability platform",
        ],
        "Python": [
            "Python 3.11+",
            "asyncio for async programming",
            "Type hints with mypy",
        ],
    }

    matching = results.get(query, [f"Results for '{query}'"])
    return json.dumps(matching[:2])


async def fetch_document(url: str) -> str:
    """Mock document fetcher."""
    documents = {
        "https://agentlens.dev": "AgentLens Documentation - AI-Readable Log Schema (ARLS)",
        "https://python.org": "Python Official Website - Programming Language",
    }

    return documents.get(url, f"Content from {url}")


async def main() -> None:
    """Run multi-tool agent example."""
    # Configure AgentLens for file logging
    config = AgentLensConfig(
        agent="ResearchAgent",
        mode="ai",  # JSONL output for analysis
        transport="file",
        file_path="research_run.log",
        privacy_enabled=True,
    )

    lens = AgentLens(config)

    try:
        # Wrap tools with instrumentation
        search = lens.wrap_tool("web_search", search_tool)
        fetch = lens.wrap_tool("fetch_document", fetch_document)

        # Wrap LLM client
        from anthropic import Anthropic

        client = lens.wrap(Anthropic())

        # Manual logging of run start
        lens.log(
            schema_type="AGENT_START",
            agent_phase="PLAN",
            metadata={"task": "Research Python observability tools"},
        )

        print("[INFO] Starting research agent...\n")

        # Step 1: Search
        print("[STEP 1] Searching for information...")
        search_results = await search("AI observability")
        print(f"  Found: {search_results}\n")

        # Step 2: LLM synthesis
        print("[STEP 2] Asking Claude to analyze results...")
        response = await client.messages.create(
            model="claude-opus-4-6-20250514",
            max_tokens=256,
            messages=[
                {
                    "role": "user",
                    "content": f"Based on these search results: {search_results}, what is AI observability?",
                }
            ],
        )

        content = response.content[0]
        if hasattr(content, 'text'):
            print(f"  Response: {content.text[:100]}...\n")

        # Step 3: Fetch document
        print("[STEP 3] Fetching AgentLens documentation...")
        doc_content = await fetch("https://agentlens.dev")
        print(f"  Doc: {doc_content}\n")

        # Manual logging of run end
        lens.log(
            schema_type="AGENT_END",
            agent_phase="RESPOND",
            metadata={
                "steps_completed": 3,
                "tools_used": 2,
                "status": "success",
            },
        )

        print("[INFO] Research complete!")
        print("[INFO] Run logged to research_run.log")
        print("[INFO] Analyze with: agentlens analyze research_run.log")

    finally:
        # Close and flush all logs
        await lens.flush()
        await lens.close()


if __name__ == "__main__":
    asyncio.run(main())
