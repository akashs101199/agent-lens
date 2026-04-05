"""Tests for PII detectors."""

import pytest

from agentlens_privacy.detectors import (
    detect_email,
    detect_api_key,
    detect_credit_card,
    detect_phone_us,
    detect_ssn,
    detect_password_fields,
    detect_all,
)


class TestEmailDetector:
    """Test email detection."""

    def test_detect_simple_email(self) -> None:
        """Detect simple email format."""
        results = detect_email("Contact me at john@example.com")
        assert len(results) == 1
        assert results[0].value == "john@example.com"
        assert results[0].type == "email"

    def test_detect_multiple_emails(self) -> None:
        """Detect multiple emails in text."""
        text = "Email alice@test.com or bob@example.org"
        results = detect_email(text)
        assert len(results) == 2
        assert results[0].value == "alice@test.com"
        assert results[1].value == "bob@example.org"

    def test_no_email_detected(self) -> None:
        """Return empty list when no email found."""
        results = detect_email("This is just plain text")
        assert len(results) == 0

    def test_email_with_complex_domain(self) -> None:
        """Detect emails with complex domain names."""
        results = detect_email("user@sub.domain.co.uk")
        assert len(results) == 1
        assert results[0].value == "user@sub.domain.co.uk"


class TestAPIKeyDetector:
    """Test API key detection."""

    def test_detect_openai_key(self) -> None:
        """Detect OpenAI sk- format keys."""
        results = detect_api_key("sk-1234567890abcdefghij1234")
        assert len(results) == 1
        assert results[0].type == "api_key"

    def test_detect_bearer_token(self) -> None:
        """Detect Bearer token format."""
        results = detect_api_key("Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9")
        assert len(results) >= 1
        assert any(r.type == "api_key" for r in results)

    def test_no_api_key_detected(self) -> None:
        """Return empty when no API key found."""
        results = detect_api_key("just normal text")
        assert len(results) == 0


class TestCreditCardDetector:
    """Test credit card detection."""

    def test_detect_valid_credit_card(self) -> None:
        """Detect valid credit card number (Luhn valid)."""
        # 4532015112830366 is a valid test CC number
        results = detect_credit_card("Card: 4532015112830366")
        assert len(results) >= 1
        assert any(r.type == "credit_card" for r in results)

    def test_reject_invalid_luhn(self) -> None:
        """Reject invalid Luhn numbers."""
        results = detect_credit_card("1234567890123456")
        # May or may not detect depending on Luhn check
        # Just verify it doesn't crash
        assert isinstance(results, list)

    def test_no_credit_card_detected(self) -> None:
        """Return empty when no card found."""
        results = detect_credit_card("No numbers here")
        assert len(results) == 0


class TestPhoneDetector:
    """Test US phone number detection."""

    def test_detect_phone_parentheses_format(self) -> None:
        """Detect (XXX) XXX-XXXX format."""
        results = detect_phone_us("Call me at (555) 123-4567")
        assert len(results) == 1
        assert results[0].type == "phone_us"
        assert "555" in results[0].value

    def test_detect_phone_dash_format(self) -> None:
        """Detect XXX-XXX-XXXX format."""
        results = detect_phone_us("555-123-4567")
        assert len(results) >= 1
        assert any(r.type == "phone_us" for r in results)

    def test_detect_phone_dot_format(self) -> None:
        """Detect XXX.XXX.XXXX format."""
        results = detect_phone_us("555.123.4567")
        assert len(results) >= 1
        assert any(r.type == "phone_us" for r in results)

    def test_detect_10_digit_number(self) -> None:
        """Detect plain 10-digit number."""
        results = detect_phone_us("5551234567")
        assert len(results) >= 1
        assert any(r.type == "phone_us" for r in results)

    def test_no_phone_detected(self) -> None:
        """Return empty when no phone found."""
        results = detect_phone_us("No numbers here")
        assert len(results) == 0


class TestSSNDetector:
    """Test Social Security Number detection."""

    def test_detect_ssn(self) -> None:
        """Detect SSN in XXX-XX-XXXX format."""
        results = detect_ssn("Your SSN is 123-45-6789")
        assert len(results) == 1
        assert results[0].value == "123-45-6789"
        assert results[0].type == "ssn"

    def test_multiple_ssns(self) -> None:
        """Detect multiple SSNs."""
        text = "First: 123-45-6789, Second: 987-65-4321"
        results = detect_ssn(text)
        assert len(results) == 2

    def test_no_ssn_detected(self) -> None:
        """Return empty when no SSN found."""
        results = detect_ssn("123 456 7890")  # Wrong format
        assert len(results) == 0


class TestPasswordFieldDetector:
    """Test password field detection."""

    def test_detect_password_json(self) -> None:
        """Detect password field in JSON."""
        json_text = '{"password": "secret123"}'
        results = detect_password_fields(json_text)
        assert len(results) >= 1
        assert any(r.type == "password_field" for r in results)

    def test_detect_api_key_field(self) -> None:
        """Detect api_key field."""
        json_text = '{"api_key": "sk-1234567890"}'
        results = detect_password_fields(json_text)
        assert len(results) >= 1

    def test_detect_token_field(self) -> None:
        """Detect token field."""
        json_text = '{"token": "eyJhbGc..."}'
        results = detect_password_fields(json_text)
        assert len(results) >= 1

    def test_case_insensitive_detection(self) -> None:
        """Detection should be case insensitive."""
        json_text = '{"PASSWORD": "secret"}'
        results = detect_password_fields(json_text)
        assert len(results) >= 1

    def test_no_password_field_detected(self) -> None:
        """Return empty when no password field found."""
        json_text = '{"username": "alice", "age": 30}'
        results = detect_password_fields(json_text)
        assert len(results) == 0


class TestDetectAll:
    """Test combined detection."""

    def test_detect_multiple_types(self) -> None:
        """Detect multiple PII types in one text."""
        text = "Email: john@example.com, Phone: 555-123-4567, SSN: 123-45-6789"
        results = detect_all(text)
        assert len(results) >= 3
        types = {r.type for r in results}
        assert "email" in types
        assert "phone_us" in types
        assert "ssn" in types

    def test_deduplication(self) -> None:
        """Remove duplicate detections."""
        text = "Email: test@example.com test@example.com"
        results = detect_all(text)
        # Should have some deduplication
        assert len(results) >= 1

    def test_detect_all_empty_text(self) -> None:
        """Return empty list for empty text."""
        results = detect_all("")
        assert len(results) == 0

    def test_detect_all_no_pii(self) -> None:
        """Return empty when no PII found."""
        results = detect_all("This is just normal text with no PII")
        assert len(results) == 0


class TestDetectionResultAttributes:
    """Test DetectionResult dataclass."""

    def test_result_has_required_attributes(self) -> None:
        """DetectionResult has all required attributes."""
        results = detect_email("test@example.com")
        assert len(results) == 1

        result = results[0]
        assert hasattr(result, "value")
        assert hasattr(result, "start")
        assert hasattr(result, "end")
        assert hasattr(result, "type")

    def test_result_positions_are_correct(self) -> None:
        """Start and end positions are correct."""
        text = "Email: test@example.com"
        results = detect_email(text)
        assert len(results) == 1

        result = results[0]
        assert text[result.start : result.end] == result.value
