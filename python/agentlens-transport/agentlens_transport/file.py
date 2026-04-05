"""
File transport for writing events to JSONL files with rotation.

Appends events to a file in JSONL format and rotates when size limit is reached.
"""

import sys
from pathlib import Path
from typing import Optional

import aiofiles

from agentlens_core import ARLSEvent

from agentlens_transport.base import BaseTransport, TransportConfig


class FileTransport(BaseTransport):
    """
    Transport that writes events to a JSONL file.

    Automatically rotates files when they exceed max_file_size.
    """

    def __init__(
        self,
        path: str = 'agentlens.log',
        max_file_size: int = 50 * 1024 * 1024,  # 50MB default
        max_rotations: int = 5,
        config: Optional[TransportConfig] = None,
    ) -> None:
        """
        Initialize file transport.

        Args:
            path: Path to log file (default: agentlens.log)
            max_file_size: Max file size before rotation (default: 50MB)
            max_rotations: Max number of rotated files to keep (default: 5)
            config: Transport configuration
        """
        super().__init__(config)
        self.path = Path(path)
        self.max_file_size = max_file_size
        self.max_rotations = max_rotations
        self.current_size = 0

        # Check existing file size
        if self.path.exists():
            self.current_size = self.path.stat().st_size

    async def drain(self, event: ARLSEvent, rendered: str) -> None:
        """
        Write event to file, rotating if necessary.

        Args:
            event: The ARLS event
            rendered: Pre-rendered JSON string (JSONL format)
        """
        try:
            # Check if we need to rotate
            await self._check_rotation()

            # Write event
            content = rendered + '\n'
            async with aiofiles.open(str(self.path), 'a') as f:
                await f.write(content)

            self.current_size += len(content.encode('utf-8'))

        except Exception as e:
            sys.stderr.write(f'[AgentLens] File write error: {e}\n')

    async def _check_rotation(self) -> None:
        """Check if file needs rotation and rotate if needed."""
        if self.path.exists():
            file_size = self.path.stat().st_size

            if file_size >= self.max_file_size:
                await self._rotate_files()

    async def _rotate_files(self) -> None:
        """Rotate log files."""
        try:
            # Remove old rotation if at max
            max_path = self.path.with_name(f'{self.path.stem}.{self.max_rotations}.log')
            if max_path.exists():
                max_path.unlink()

            # Shift existing rotations
            for i in range(self.max_rotations - 1, 0, -1):
                old_path = self.path.with_name(f'{self.path.stem}.{i}.log')
                new_path = self.path.with_name(f'{self.path.stem}.{i + 1}.log')

                if old_path.exists():
                    old_path.rename(new_path)

            # Rename current to .1
            if self.path.exists():
                self.path.rename(self.path.with_name(f'{self.path.stem}.1.log'))

            self.current_size = 0

        except Exception as e:
            sys.stderr.write(f'[AgentLens] File rotation error: {e}\n')

    async def close(self) -> None:
        """Close transport gracefully."""
        await super().close()


class CompactFileTransport(FileTransport):
    """
    File transport with smaller overhead.

    Useful for high-volume logging.
    """

    def __init__(
        self,
        path: str = 'agentlens.log',
        max_file_size: int = 10 * 1024 * 1024,  # 10MB default
        max_rotations: int = 3,
        config: Optional[TransportConfig] = None,
    ) -> None:
        """
        Initialize compact file transport.

        Args:
            path: Path to log file
            max_file_size: Max file size before rotation
            max_rotations: Max number of rotated files
            config: Transport configuration
        """
        super().__init__(path, max_file_size, max_rotations, config)
