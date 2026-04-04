import { describe, it, expect } from 'vitest'
import {
  detectEmail,
  detectApiKey,
  detectCreditCard,
  detectPhoneUS,
  detectSSN,
  detectPassword,
  detectAllPII,
  type DetectionResult,
} from '../src/detectors.js'

describe('PII Detectors', () => {
  describe('Email Detector', () => {
    it('should detect single email', () => {
      const results = detectEmail('Contact me at user@example.com')
      expect(results).toHaveLength(1)
      expect(results[0].value).toBe('user@example.com')
      expect(results[0].type).toBe('EMAIL')
    })

    it('should detect multiple emails', () => {
      const results = detectEmail('Email alice@example.com or bob@test.org')
      expect(results).toHaveLength(2)
      expect(results[0].value).toBe('alice@example.com')
      expect(results[1].value).toBe('bob@test.org')
    })

    it('should not detect invalid emails', () => {
      const results = detectEmail('Invalid: @example.com or user@')
      expect(results).toHaveLength(0)
    })

    it('should handle no emails', () => {
      const results = detectEmail('No emails here')
      expect(results).toHaveLength(0)
    })
  })

  describe('API Key Detector', () => {
    it('should detect sk- prefix keys', () => {
      const results = detectApiKey('API key: sk-1234567890abcdefghij')
      expect(results).toHaveLength(1)
      expect(results[0].value).toMatch(/^sk-/)
      expect(results[0].type).toBe('API_KEY')
    })

    it('should detect ak- prefix keys', () => {
      const results = detectApiKey('Access key: ak-abcdefghij1234567890')
      expect(results).toHaveLength(1)
      expect(results[0].value).toMatch(/^ak-/)
    })

    it('should detect pk- prefix keys', () => {
      const results = detectApiKey('Public key: pk-xyz1234567890abcdefghij')
      expect(results).toHaveLength(1)
      expect(results[0].value).toMatch(/^pk-/)
    })

    it('should detect Bearer tokens', () => {
      const results = detectApiKey('Authorization: Bearer token123456789abcdef')
      expect(results).toHaveLength(1)
      expect(results[0].value).toMatch(/^Bearer/)
    })

    it('should not detect short keys', () => {
      const results = detectApiKey('sk-short')
      expect(results).toHaveLength(0)
    })
  })

  describe('Credit Card Detector', () => {
    it('should detect valid credit card (Visa)', () => {
      // Valid test Visa number (passes Luhn)
      const results = detectCreditCard('Card: 4532015112830366')
      expect(results).toHaveLength(1)
      expect(results[0].value).toBe('4532015112830366')
      expect(results[0].type).toBe('CREDIT_CARD')
    })

    it('should detect valid credit card (MasterCard)', () => {
      // Valid test MasterCard number (passes Luhn)
      const results = detectCreditCard('5105105105105100')
      expect(results).toHaveLength(1)
    })

    it('should reject invalid card numbers', () => {
      // Invalid number that fails Luhn check
      const results = detectCreditCard('1234567890123456')
      expect(results).toHaveLength(0)
    })

    it('should not detect random digit sequences', () => {
      const results = detectCreditCard('Just some numbers 12345 67890')
      expect(results.length).toBeLessThanOrEqual(0)
    })
  })

  describe('Phone Number Detector', () => {
    it('should detect (123) 456-7890 format', () => {
      const results = detectPhoneUS('Call me at (555) 123-4567')
      expect(results).toHaveLength(1)
      expect(results[0].value).toBe('(555) 123-4567')
      expect(results[0].type).toBe('PHONE_US')
    })

    it('should detect 123-456-7890 format', () => {
      const results = detectPhoneUS('Phone: 555-123-4567')
      expect(results).toHaveLength(1)
      expect(results[0].value).toBe('555-123-4567')
    })

    it('should detect 123.456.7890 format', () => {
      const results = detectPhoneUS('Tel: 555.123.4567')
      expect(results).toHaveLength(1)
      expect(results[0].value).toBe('555.123.4567')
    })

    it('should detect 10 digit format', () => {
      const results = detectPhoneUS('5551234567')
      expect(results).toHaveLength(1)
      expect(results[0].value).toBe('5551234567')
    })

    it('should detect multiple phone numbers', () => {
      const results = detectPhoneUS('Call 555-123-4567 or (555) 987-6543')
      expect(results).toHaveLength(2)
    })
  })

  describe('SSN Detector', () => {
    it('should detect XXX-XX-XXXX format', () => {
      const results = detectSSN('SSN: 123-45-6789')
      expect(results).toHaveLength(1)
      expect(results[0].value).toBe('123-45-6789')
      expect(results[0].type).toBe('SSN')
    })

    it('should detect 9 digit format', () => {
      const results = detectSSN('Social: 123456789')
      expect(results).toHaveLength(1)
      expect(results[0].value).toBe('123456789')
    })

    it('should not confuse with dates', () => {
      const results = detectSSN('Date: 2025-01-15')
      // Should not match date format
      expect(results).toHaveLength(0)
    })

    it('should detect multiple SSNs', () => {
      const results = detectSSN('123-45-6789 and 987-65-4321')
      expect(results).toHaveLength(2)
    })
  })

  describe('Password Detector', () => {
    it('should detect password fields', () => {
      const results = detectPassword('{"password": "secret123"}')
      expect(results.length).toBeGreaterThan(0)
      expect(results[0].type).toBe('PASSWORD')
    })

    it('should detect passwd fields', () => {
      const results = detectPassword('passwd=mypassword123')
      expect(results.length).toBeGreaterThan(0)
    })

    it('should detect secret fields', () => {
      const results = detectPassword('{"secret": "confidential"}')
      expect(results.length).toBeGreaterThan(0)
    })

    it('should detect token fields', () => {
      const results = detectPassword('token: abc123xyz789')
      expect(results.length).toBeGreaterThan(0)
    })

    it('should handle multiple password fields', () => {
      const results = detectPassword(
        '{"password": "pass1", "secret": "sec2", "token": "tok3"}',
      )
      expect(results.length).toBeGreaterThanOrEqual(2)
    })
  })

  describe('Detector Error Handling', () => {
    it('should not throw on malformed input', () => {
      expect(() => detectEmail(null as unknown as string)).not.toThrow()
      expect(() => detectApiKey(undefined as unknown as string)).not.toThrow()
      expect(() => detectCreditCard('')).not.toThrow()
    })

    it('should return empty array on error', () => {
      const results = detectEmail(null as unknown as string)
      expect(Array.isArray(results)).toBe(true)
      expect(results).toHaveLength(0)
    })

    it('should handle very long strings', () => {
      const prefix = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. '.repeat(200)
      const suffix = ' Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. '.repeat(200)
      const longString = prefix + 'user@example.com' + suffix
      const results = detectEmail(longString)
      expect(results).toHaveLength(1)
      expect(results[0].value).toBe('user@example.com')
    })
  })

  describe('Detector Result Properties', () => {
    it('should include correct start and end positions', () => {
      const input = 'Email: user@example.com is valid'
      const results = detectEmail(input)
      expect(results[0].start).toBe(input.indexOf('user@example.com'))
      expect(results[0].end).toBe(input.indexOf('user@example.com') + 'user@example.com'.length)
    })

    it('should have all required properties', () => {
      const results = detectEmail('test@example.com')
      expect(results[0]).toHaveProperty('value')
      expect(results[0]).toHaveProperty('start')
      expect(results[0]).toHaveProperty('end')
      expect(results[0]).toHaveProperty('type')
    })
  })

  describe('Detect All PII', () => {
    it('should find multiple types of PII', () => {
      const input = `
        Contact: user@example.com
        Phone: 555-123-4567
        API Key: sk-1234567890abcdefghij
        SSN: 123-45-6789
      `
      const results = detectAllPII(input)
      const types = results.map((r) => r.type)
      expect(types).toContain('EMAIL')
      expect(types).toContain('PHONE_US')
      expect(types).toContain('API_KEY')
      expect(types).toContain('SSN')
    })

    it('should sort results by position', () => {
      const input = 'First: user@example.com, Phone: 555-123-4567, Email: test@test.com'
      const results = detectAllPII(input)
      for (let i = 1; i < results.length; i++) {
        expect(results[i].start).toBeGreaterThanOrEqual(results[i - 1].start)
      }
    })

    it('should handle no PII', () => {
      const results = detectAllPII('Just a normal sentence with no sensitive data')
      expect(results).toHaveLength(0)
    })

    it('should handle mixed content', () => {
      const input = 'Hello world, contact alice@example.com for info'
      const results = detectAllPII(input)
      expect(results.length).toBeGreaterThan(0)
      expect(results[0].value).toBe('alice@example.com')
    })
  })
})
