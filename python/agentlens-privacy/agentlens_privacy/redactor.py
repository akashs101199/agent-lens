"""
PII redaction engine.

Applies redaction masks to detected sensitive data in text and objects.
"""

import hashlib
from dataclasses import dataclass
from typing import Any, Optional

from agentlens_core import ARLSEvent, RedactionMode, PrivacyData

from agentlens_privacy.detectors import (
    DetectionResult,
    detect_all,
)


@dataclass
class RedactionResult:
    """
    Result of redacting a string.

    Attributes:
        original: Original unredacted text
        redacted: Text with PII replaced
        detections: List of PII detections that were redacted
        redaction_mode: Mode used for redaction
    """

    original: str
    redacted: str
    detections: list[DetectionResult]
    redaction_mode: RedactionMode


def redact_string(
    text: str,
    mode: RedactionMode = RedactionMode.MASK,
) -> RedactionResult:
    """
    Redact PII from a string value.

    Args:
        text: Text to redact
        mode: Redaction mode (MASK, HASH, DROP, PLACEHOLDER)

    Returns:
        RedactionResult with redacted text and detection info
    """
    detections = detect_all(text)

    if not detections:
        # No PII found
        return RedactionResult(
            original=text,
            redacted=text,
            detections=[],
            redaction_mode=mode,
        )

    redacted = text
    offset = 0

    # Apply redactions in order (adjusting offsets as we go)
    for detection in detections:
        start = detection.start + offset
        end = detection.end + offset

        if mode == RedactionMode.MASK:
            replacement = '[REDACTED]'
        elif mode == RedactionMode.HASH:
            hash_val = hashlib.sha256(detection.value.encode()).hexdigest()[:8]
            replacement = f'[sha256:{hash_val}]'
        elif mode == RedactionMode.DROP:
            replacement = ''
        else:  # RedactionMode.PLACEHOLDER
            replacement = f'[{detection.type.upper()}]'

        redacted = redacted[:start] + replacement + redacted[end:]
        offset += len(replacement) - (end - start)

    return RedactionResult(
        original=text,
        redacted=redacted,
        detections=detections,
        redaction_mode=mode,
    )


def redact_object(
    obj: Any,
    mode: RedactionMode = RedactionMode.MASK,
) -> tuple[Any, list[str]]:
    """
    Recursively redact PII from an object (dict, list, or string).

    Args:
        obj: Object to redact (dict, list, str, etc.)
        mode: Redaction mode

    Returns:
        Tuple of (redacted_object, list_of_redacted_field_paths)
    """
    redacted_fields: list[str] = []

    def _redact_recursive(value: Any, path: str = '') -> Any:
        """Recursively redact an object."""
        if isinstance(value, str):
            result = redact_string(value, mode)
            if result.detections:
                redacted_fields.append(path or 'root')
            return result.redacted

        elif isinstance(value, dict):
            redacted_dict = {}
            for k, v in value.items():
                new_path = f'{path}.{k}' if path else k
                redacted_dict[k] = _redact_recursive(v, new_path)
            return redacted_dict

        elif isinstance(value, list):
            redacted_list = []
            for i, item in enumerate(value):
                new_path = f'{path}[{i}]'
                redacted_list.append(_redact_recursive(item, new_path))
            return redacted_list

        elif isinstance(value, tuple):
            redacted_tuple = tuple(
                _redact_recursive(item, f'{path}[{i}]')
                for i, item in enumerate(value)
            )
            return redacted_tuple

        else:
            # Leave non-string primitives unchanged
            return value

    redacted_obj = _redact_recursive(obj)
    return redacted_obj, redacted_fields


def redact_event(
    event: ARLSEvent,
    mode: RedactionMode = RedactionMode.MASK,
) -> ARLSEvent:
    """
    Redact PII from an ARLS event.

    Redacts: tool input/output, metadata, and other string fields.
    Returns a new event with redacted values.

    Args:
        event: ARLS event to redact
        mode: Redaction mode

    Returns:
        New ARLSEvent with redacted values
    """
    redacted_fields_list: list[str] = []

    # Redact tool input
    tool_input = None
    if event.tool and event.tool.input:
        tool_input, fields = redact_object(event.tool.input, mode)
        redacted_fields_list.extend([f'tool.input.{f}' for f in fields])

    # Redact tool output
    tool_output = None
    if event.tool and event.tool.output:
        tool_output, fields = redact_object(event.tool.output, mode)
        redacted_fields_list.extend([f'tool.output.{f}' for f in fields])

    # Redact metadata
    metadata = None
    if event.metadata:
        metadata, fields = redact_object(event.metadata, mode)
        redacted_fields_list.extend([f'metadata.{f}' for f in fields])

    # Redact error message
    error_message = None
    if event.error and event.error.message:
        result = redact_string(event.error.message, mode)
        error_message = result.redacted
        if result.detections:
            redacted_fields_list.append('error.message')

    # Redact ai_debug_hint
    ai_debug_hint = None
    if event.ai_debug_hint:
        result = redact_string(event.ai_debug_hint, mode)
        ai_debug_hint = result.redacted
        if result.detections:
            redacted_fields_list.append('ai_debug_hint')

    # Create new event with redacted values
    if tool_input is not None or tool_output is not None:
        new_tool = (
            event.tool.__class__(
                name=event.tool.name,
                input=tool_input or event.tool.input,
                output=tool_output or event.tool.output,
                status=event.tool.status,
                duration_ms=event.tool.duration_ms,
                error_message=event.tool.error_message,
            )
            if event.tool
            else None
        )
    else:
        new_tool = event.tool

    new_error = (
        event.error.__class__(
            code=event.error.code,
            message=error_message or event.error.message,
            stack=event.error.stack,
            recoverable=event.error.recoverable,
            recovery_hint=event.error.recovery_hint,
        )
        if event.error and error_message
        else event.error
    )

    return ARLSEvent(
        agentlens_version=event.agentlens_version,
        schema_type=event.schema_type,
        timestamp=event.timestamp,
        trace_id=event.trace_id,
        run_id=event.run_id,
        step_index=event.step_index,
        agent=event.agent,
        privacy=PrivacyData(
            pii_detected=len(redacted_fields_list) > 0,
            redacted_fields=redacted_fields_list,
            redaction_mode=mode,
        ),
        semantic_tags=event.semantic_tags,
        llm=event.llm,
        tool=new_tool,
        memory=event.memory,
        error=new_error,
        ai_debug_hint=ai_debug_hint or event.ai_debug_hint,
        metadata=metadata,
    )
