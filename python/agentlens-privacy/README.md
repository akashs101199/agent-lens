# agentlens-privacy

PII (Personally Identifiable Information) detection and redaction.

Detects and masks sensitive data before logging:
- Email addresses
- API keys and tokens
- Credit card numbers
- US phone numbers
- Social Security Numbers
- Password fields

## Installation

```bash
pip install agentlens-privacy
```

## Quick Start

### Detect PII

```python
from agentlens_privacy import detect_all, detect_email

# Detect all PII types
results = detect_all("Email: john@example.com, Phone: 555-123-4567")
for detection in results:
    print(f"Found {detection.type}: {detection.value}")

# Detect specific type
emails = detect_email("Contact alice@test.com or bob@test.com")
```

### Redact Strings

```python
from agentlens_privacy import redact_string
from agentlens_core import RedactionMode

# Mask sensitive data
result = redact_string(
    "Email: john@example.com",
    mode=RedactionMode.MASK  # Replace with [REDACTED]
)
print(result.redacted)  # "Email: [REDACTED]"

# Hash sensitive data
result = redact_string(
    "Email: john@example.com",
    mode=RedactionMode.HASH  # Replace with [sha256:...]
)

# Drop sensitive data entirely
result = redact_string(
    "Email: john@example.com",
    mode=RedactionMode.DROP
)

# Use type placeholders
result = redact_string(
    "Email: john@example.com",
    mode=RedactionMode.PLACEHOLDER  # Replace with [EMAIL]
)
```

### Redact Objects

```python
from agentlens_privacy import redact_object
from agentlens_core import RedactionMode

obj = {
    "user": {
        "name": "Alice",
        "email": "alice@example.com",
        "phone": "555-123-4567"
    }
}

redacted, fields = redact_object(obj, mode=RedactionMode.MASK)
# fields contains: ['user.email', 'user.phone']
```

### Redact ARLS Events

```python
from agentlens_privacy import redact_event
from agentlens_core import RedactionMode, ARLSEvent

# Redact tool inputs, outputs, metadata, error messages
redacted_event = redact_event(event, mode=RedactionMode.MASK)

# Check what was redacted
print(redacted_event.privacy.pii_detected)  # True/False
print(redacted_event.privacy.redacted_fields)  # ['tool.input.email', ...]
```

## Redaction Modes

| Mode | Behavior | Example |
|------|----------|---------|
| `MASK` | Replace with `[REDACTED]` | `john@example.com` → `[REDACTED]` |
| `HASH` | Replace with `[sha256:first8]` | `john@example.com` → `[sha256:a7f3c1d2]` |
| `DROP` | Remove entirely | `Contact: john@example.com` → `Contact: ` |
| `PLACEHOLDER` | Replace with `[TYPE]` | `john@example.com` → `[EMAIL]` |

## Detectors

Included PII detectors:

- `detect_email()` - Email addresses
- `detect_api_key()` - API keys (sk-, ak-, pk-, Bearer tokens)
- `detect_credit_card()` - Credit card numbers (Luhn validated)
- `detect_phone_us()` - US phone numbers (multiple formats)
- `detect_ssn()` - Social Security Numbers (XXX-XX-XXXX)
- `detect_password_fields()` - Password, token, secret fields in JSON/dicts
- `detect_all()` - All of the above combined

## Zero Dependencies

The privacy package has zero runtime dependencies. It uses only:
- `agentlens-core` (which itself has zero dependencies)
- Python standard library (`re`, `hashlib`, `dataclasses`)
