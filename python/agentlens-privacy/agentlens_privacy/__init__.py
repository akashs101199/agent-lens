"""
AgentLens Privacy Package

Provides PII detection and redaction for log events.
"""

from agentlens_privacy.detectors import (
    DetectionResult,
    detect_email,
    detect_api_key,
    detect_credit_card,
    detect_phone_us,
    detect_ssn,
    detect_password_fields,
    detect_all,
)
from agentlens_privacy.redactor import (
    RedactionResult,
    redact_string,
    redact_object,
    redact_event,
)

__all__ = [
    # Detectors
    "DetectionResult",
    "detect_email",
    "detect_api_key",
    "detect_credit_card",
    "detect_phone_us",
    "detect_ssn",
    "detect_password_fields",
    "detect_all",
    # Redaction
    "RedactionResult",
    "redact_string",
    "redact_object",
    "redact_event",
]
