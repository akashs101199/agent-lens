"""
AgentLens Renderer Package

Provides human-readable and AI-readable output formatting for ARLS events.
"""

from agentlens_renderer.human import (
    Colors,
    Emoji,
    render_human,
    render_human_compact,
)
from agentlens_renderer.ai import (
    render_ai,
    render_ai_compact,
)

__all__ = [
    # Human renderer
    "Colors",
    "Emoji",
    "render_human",
    "render_human_compact",
    # AI renderer
    "render_ai",
    "render_ai_compact",
]
