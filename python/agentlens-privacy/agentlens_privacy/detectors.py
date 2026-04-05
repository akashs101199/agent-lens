"""
PII (Personally Identifiable Information) detectors.

Pure functions that identify patterns in text that may contain sensitive data.
Used by the redaction engine to locate PII for masking/hashing.
"""

import re
from dataclasses import dataclass
from typing import Optional


@dataclass
class DetectionResult:
    """
    Result of a PII detection match.

    Attributes:
        value: The matched string
        start: Start index in original text
        end: End index in original text
        type: Detection type (e.g., 'email', 'api_key', 'credit_card')
    """

    value: str
    start: int
    end: int
    type: str


def detect_email(text: str) -> list[DetectionResult]:
    """
    Detect email addresses in text.

    Pattern: standard email format (user@domain.com)

    Args:
        text: Text to search for email addresses

    Returns:
        List of DetectionResult objects for each email found
    """
    pattern = r'[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}'
    results: list[DetectionResult] = []

    try:
        for match in re.finditer(pattern, text):
            results.append(
                DetectionResult(
                    value=match.group(),
                    start=match.start(),
                    end=match.end(),
                    type='email',
                )
            )
    except Exception:
        # Return empty list on any regex error
        pass

    return results


def detect_api_key(text: str) -> list[DetectionResult]:
    """
    Detect API keys and tokens in text.

    Patterns:
    - sk-* (OpenAI keys)
    - ak-* (AWS keys)
    - pk-* (Stripe keys)
    - Bearer tokens

    Args:
        text: Text to search for API keys

    Returns:
        List of DetectionResult objects for each key found
    """
    patterns = [
        r'["\']?(sk-[A-Za-z0-9\-_]{20,})["\']?',  # OpenAI
        r'["\']?(ak-[A-Za-z0-9\-_]{20,})["\']?',  # AWS
        r'["\']?(pk-[A-Za-z0-9\-_]{20,})["\']?',  # Stripe
        r'Bearer\s+[A-Za-z0-9\-._~+/]+=*',  # Bearer tokens
    ]

    results: list[DetectionResult] = []

    try:
        for pattern in patterns:
            for match in re.finditer(pattern, text, re.IGNORECASE):
                results.append(
                    DetectionResult(
                        value=match.group(),
                        start=match.start(),
                        end=match.end(),
                        type='api_key',
                    )
                )
    except Exception:
        pass

    return results


def detect_credit_card(text: str) -> list[DetectionResult]:
    """
    Detect credit card numbers using Luhn algorithm validation.

    Pattern: 13-19 digit sequences that pass Luhn checksum

    Args:
        text: Text to search for credit card numbers

    Returns:
        List of DetectionResult objects for each card found
    """
    pattern = r'\b\d{13,19}\b'
    results: list[DetectionResult] = []

    try:
        for match in re.finditer(pattern, text):
            number = match.group().replace(' ', '').replace('-', '')

            # Validate with Luhn algorithm
            if _luhn_check(number):
                results.append(
                    DetectionResult(
                        value=match.group(),
                        start=match.start(),
                        end=match.end(),
                        type='credit_card',
                    )
                )
    except Exception:
        pass

    return results


def _luhn_check(number: str) -> bool:
    """
    Validate a number using the Luhn algorithm.

    Args:
        number: String of digits to validate

    Returns:
        True if number passes Luhn checksum, False otherwise
    """
    if not number.isdigit():
        return False

    digits = [int(d) for d in number]
    checksum = 0

    # Process digits from right to left
    for i, digit in enumerate(reversed(digits)):
        if i % 2 == 1:  # Every second digit from right
            digit *= 2
            if digit > 9:
                digit -= 9

        checksum += digit

    return checksum % 10 == 0


def detect_phone_us(text: str) -> list[DetectionResult]:
    """
    Detect US phone numbers in text.

    Patterns:
    - (XXX) XXX-XXXX
    - XXX-XXX-XXXX
    - XXX.XXX.XXXX
    - XXXXXXXXXX

    Args:
        text: Text to search for phone numbers

    Returns:
        List of DetectionResult objects for each number found
    """
    patterns = [
        r'\(\d{3}\)\s?\d{3}[-.]?\d{4}',  # (XXX) XXX-XXXX
        r'\d{3}[-.]?\d{3}[-.]?\d{4}',    # XXX-XXX-XXXX or XXX.XXX.XXXX
        r'\b\d{10}\b',                    # XXXXXXXXXX (10 digit number)
    ]

    results: list[DetectionResult] = []

    try:
        for pattern in patterns:
            for match in re.finditer(pattern, text):
                results.append(
                    DetectionResult(
                        value=match.group(),
                        start=match.start(),
                        end=match.end(),
                        type='phone_us',
                    )
                )
    except Exception:
        pass

    return results


def detect_ssn(text: str) -> list[DetectionResult]:
    """
    Detect US Social Security Numbers in text.

    Pattern: XXX-XX-XXXX format

    Args:
        text: Text to search for SSNs

    Returns:
        List of DetectionResult objects for each SSN found
    """
    pattern = r'\b\d{3}-\d{2}-\d{4}\b'
    results: list[DetectionResult] = []

    try:
        for match in re.finditer(pattern, text):
            results.append(
                DetectionResult(
                    value=match.group(),
                    start=match.start(),
                    end=match.end(),
                    type='ssn',
                )
            )
    except Exception:
        pass

    return results


def detect_password_fields(text: str) -> list[DetectionResult]:
    """
    Detect password field names and values in JSON/dict-like text.

    Pattern: Field names like 'password', 'passwd', 'secret', 'token'

    Args:
        text: Text to search for password field declarations

    Returns:
        List of DetectionResult objects for each field found
    """
    patterns = [
        r'"(password|passwd|pwd|secret|apikey|api_key|token|auth|authorization)"\s*:\s*"([^"]*)"',
        r"'(password|passwd|pwd|secret|apikey|api_key|token|auth|authorization)'\s*:\s*'([^']*)'",
    ]

    results: list[DetectionResult] = []

    try:
        for pattern in patterns:
            for match in re.finditer(pattern, text, re.IGNORECASE):
                # Return the entire match (key + value)
                results.append(
                    DetectionResult(
                        value=match.group(),
                        start=match.start(),
                        end=match.end(),
                        type='password_field',
                    )
                )
    except Exception:
        pass

    return results


def detect_all(text: str) -> list[DetectionResult]:
    """
    Run all detectors on text and return combined results.

    Args:
        text: Text to scan for all types of PII

    Returns:
        List of all DetectionResult objects found
    """
    all_results: list[DetectionResult] = []

    all_results.extend(detect_email(text))
    all_results.extend(detect_api_key(text))
    all_results.extend(detect_credit_card(text))
    all_results.extend(detect_phone_us(text))
    all_results.extend(detect_ssn(text))
    all_results.extend(detect_password_fields(text))

    # Sort by start position and remove duplicates
    all_results = sorted(all_results, key=lambda r: r.start)
    seen: set[tuple[int, int]] = set()
    deduplicated: list[DetectionResult] = []

    for result in all_results:
        key = (result.start, result.end)
        if key not in seen:
            deduplicated.append(result)
            seen.add(key)

    return deduplicated
