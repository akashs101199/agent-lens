"""
Abstract base transport class and async queue implementation.

All transports must implement the Transport interface for non-blocking event persistence.
"""

import asyncio
import sys
from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Optional

from agentlens_core import ARLSEvent


@dataclass
class TransportConfig:
    """Configuration for transport behavior."""

    max_queue_size: int = 1000
    flush_interval_seconds: float = 5.0


class Transport(ABC):
    """
    Abstract base class for log event transports.

    All transports must implement write(), flush(), and close() methods.
    Writes must never block the calling code.
    """

    @abstractmethod
    async def write(self, event: ARLSEvent, rendered: str) -> None:
        """
        Write an event to the transport (non-blocking).

        Args:
            event: The ARLS event to write
            rendered: Pre-rendered string representation

        Raises:
            Any transport-specific exceptions
        """
        pass

    @abstractmethod
    async def flush(self) -> None:
        """
        Flush all pending events to storage.

        Waits until queue is empty before returning.
        """
        pass

    @abstractmethod
    async def close(self) -> None:
        """
        Close the transport and release resources.

        Calls flush() before closing.
        """
        pass


class BaseTransport(Transport):
    """
    Base transport implementation with async queue management.

    Provides:
    - Non-blocking write queue
    - Automatic background flushing
    - Configurable queue size limits
    - Graceful shutdown
    """

    def __init__(self, config: Optional[TransportConfig] = None) -> None:
        """
        Initialize base transport.

        Args:
            config: Transport configuration
        """
        self.config = config or TransportConfig()
        self.queue: asyncio.Queue[tuple[ARLSEvent, str]] = asyncio.Queue(
            maxsize=self.config.max_queue_size
        )
        self.running = True
        self._background_task: Optional[asyncio.Task[None]] = None

    async def write(self, event: ARLSEvent, rendered: str) -> None:
        """
        Queue an event for writing (non-blocking).

        If queue is full, drops oldest events and logs warning.

        Args:
            event: The ARLS event
            rendered: Pre-rendered string
        """
        if not self.running:
            return

        try:
            # Try to add with small timeout to avoid blocking
            self.queue.put_nowait((event, rendered))
        except asyncio.QueueFull:
            # Queue is full, drop oldest item
            try:
                self.queue.get_nowait()
                self.queue.put_nowait((event, rendered))
                sys.stderr.write(
                    '[AgentLens] Warning: transport queue full, dropping oldest event\n'
                )
            except asyncio.QueueEmpty:
                pass

    async def flush(self) -> None:
        """
        Flush all pending events from queue.

        Waits until queue is empty before returning.
        """
        if not self.running:
            return

        # Process all queued items
        while not self.queue.empty():
            try:
                event, rendered = self.queue.get_nowait()
                await self.drain(event, rendered)
            except asyncio.QueueEmpty:
                break

    async def close(self) -> None:
        """
        Close transport gracefully.

        Flushes queue before closing.
        """
        # Final flush (before setting running=False)
        await self.flush()

        self.running = False

        # Cancel background task if running
        if self._background_task and not self._background_task.done():
            self._background_task.cancel()
            try:
                await self._background_task
            except asyncio.CancelledError:
                pass

    @abstractmethod
    async def drain(self, event: ARLSEvent, rendered: str) -> None:
        """
        Actually write the event to storage.

        Subclasses implement this to write to files, stdout, etc.

        Args:
            event: The ARLS event
            rendered: Pre-rendered string
        """
        pass

    async def _background_flush(self) -> None:
        """Background task for periodic flushing."""
        while self.running:
            try:
                await asyncio.sleep(self.config.flush_interval_seconds)
                if not self.queue.empty():
                    await self.flush()
            except asyncio.CancelledError:
                break
            except Exception as e:
                sys.stderr.write(
                    f'[AgentLens] Background flush error: {e}\n'
                )

    def start_background_flush(self) -> None:
        """Start the background flush task."""
        if self._background_task is None or self._background_task.done():
            self._background_task = asyncio.create_task(self._background_flush())
