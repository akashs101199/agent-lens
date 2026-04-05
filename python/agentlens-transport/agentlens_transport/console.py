"""
Console transport for writing events to stdout.

Writes events to standard output using pre-rendered strings.
"""

import sys
from typing import Any, Optional

from agentlens_core import ARLSEvent

from agentlens_transport.base import BaseTransport, TransportConfig


class ConsoleTransport(BaseTransport):
    """
    Transport that writes events to stdout/stderr.

    Useful for development and testing.
    """

    def __init__(
        self,
        file: Optional[Any] = None,
        config: Optional[TransportConfig] = None,
    ) -> None:
        """
        Initialize console transport.

        Args:
            file: File to write to (default: sys.stdout)
            config: Transport configuration
        """
        super().__init__(config)
        self.file = file or sys.stdout

    async def drain(self, event: ARLSEvent, rendered: str) -> None:
        """
        Write event to console.

        Args:
            event: The ARLS event (used for context)
            rendered: Pre-rendered string to output
        """
        try:
            # Write the rendered output
            self.file.write(rendered)
            self.file.write('\n')
            self.file.flush()
        except Exception as e:
            sys.stderr.write(f'[AgentLens] Console write error: {e}\n')
