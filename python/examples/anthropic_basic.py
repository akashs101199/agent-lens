#!/usr/bin/env python3
"""
AgentLens Basic Example — Anthropic SDK

Demonstrates wrapping an Anthropic client to automatically log LLM calls.

Usage:
    ANTHROPIC_API_KEY=your-key python anthropic_basic.py

Output:
    - Human-readable logs to console
    - JSONL logs to agentlens.log
"""

import asyncio
from agentlens import AgentLens, AgentLensConfig


async def main() -> None:
    """Run basic example with Anthropic client."""
    # Configure AgentLens
    config = AgentLensConfig(
        agent="BasicAgent",
        mode="human",  # Human-readable terminal output
        transport="console",  # Log to stdout
        privacy_enabled=True,
        redaction_mode="MASK",
    )

    lens = AgentLens(config)

    try:
        # Wrap Anthropic client
        from anthropic import Anthropic

        client = lens.wrap(Anthropic())

        # Create a simple message
        print("[INFO] Sending request to Claude API...\n")

        response = await client.messages.create(
            model="claude-opus-4-6-20250514",
            max_tokens=256,
            messages=[
                {
                    "role": "user",
                    "content": "What is the capital of France? Answer in one sentence.",
                }
            ],
        )

        # Display result
        content = response.content[0]
        if hasattr(content, 'text'):
            print(f"[RESPONSE] {content.text}\n")

        print("[INFO] Call completed — check logs above for AgentLens output")

    finally:
        # Close and flush logs
        await lens.flush()
        await lens.close()


if __name__ == "__main__":
    asyncio.run(main())
