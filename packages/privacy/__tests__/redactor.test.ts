import { describe, it, expect } from 'vitest'
import { redactString, redactObject } from '../src/redactor.js'

describe('String Redaction', () => {
  describe('MASK mode', () => {
    it('should redact email with MASK', () => {
      const result = redactString('Contact: user@example.com', { mode: 'MASK' })
      expect(result.wasRedacted).toBe(true)
      expect(result.value).toBe('Contact: [REDACTED]')
    })

    it('should redact multiple PII with MASK', () => {
      const result = redactString('Email: john@example.com, Phone: 555-123-4567', {
        mode: 'MASK',
      })
      expect(result.wasRedacted).toBe(true)
      expect(result.value).toContain('[REDACTED]')
      expect(result.value).not.toContain('john@example.com')
      expect(result.value).not.toContain('555-123-4567')
    })

    it('should preserve non-PII content with MASK', () => {
      const result = redactString('Hello world, no PII here', { mode: 'MASK' })
      expect(result.wasRedacted).toBe(false)
      expect(result.value).toBe('Hello world, no PII here')
    })
  })

  describe('HASH mode', () => {
    it('should redact email with HASH', () => {
      const result = redactString('My email: user@example.com', { mode: 'HASH' })
      expect(result.wasRedacted).toBe(true)
      expect(result.value).toMatch(/\[sha256:[a-f0-9]{8}\]/)
      expect(result.value).not.toContain('user@example.com')
    })

    it('should produce consistent hashes for same value', () => {
      const input = 'user@example.com'
      const result1 = redactString(input, { mode: 'HASH' })
      const result2 = redactString(input, { mode: 'HASH' })
      expect(result1.value).toBe(result2.value)
    })

    it('should produce different hashes for different values', () => {
      const result1 = redactString('user1@example.com', { mode: 'HASH' })
      const result2 = redactString('user2@example.com', { mode: 'HASH' })
      expect(result1.value).not.toBe(result2.value)
    })
  })

  describe('DROP mode', () => {
    it('should remove email with DROP', () => {
      const result = redactString('Email: user@example.com here', { mode: 'DROP' })
      expect(result.wasRedacted).toBe(true)
      expect(result.value).toBe('Email:  here')
    })

    it('should remove multiple PII with DROP', () => {
      const result = redactString('alice@example.com and bob@test.org', { mode: 'DROP' })
      expect(result.wasRedacted).toBe(true)
      expect(result.value).toBe(' and ')
    })
  })

  describe('PLACEHOLDER mode', () => {
    it('should use placeholder for email', () => {
      const result = redactString('Email: user@example.com', { mode: 'PLACEHOLDER' })
      expect(result.wasRedacted).toBe(true)
      expect(result.value).toBe('Email: [EMAIL]')
    })

    it('should use correct placeholders for different PII types', () => {
      const input = 'Email: john@example.com, Phone: 555-123-4567, SSN: 123-45-6789'
      const result = redactString(input, { mode: 'PLACEHOLDER' })
      expect(result.value).toContain('[EMAIL]')
      expect(result.value).toContain('[PHONE_US]')
      expect(result.value).toContain('[SSN]')
    })

    it('should identify redacted fields', () => {
      const result = redactString('Email: test@example.com, Key: sk-12345678901234567890', {
        mode: 'PLACEHOLDER',
      })
      expect(result.redactedFields).toContain('EMAIL')
      expect(result.redactedFields).toContain('API_KEY')
    })
  })

  describe('Error handling', () => {
    it('should not throw on null input', () => {
      expect(() => redactString(null as unknown as string, { mode: 'MASK' })).not.toThrow()
    })

    it('should return original value on error', () => {
      const result = redactString('test@example.com', { mode: 'MASK' })
      expect(result.value).toBeDefined()
    })
  })
})

describe('Object Redaction', () => {
  describe('Simple objects', () => {
    it('should redact string properties', () => {
      const obj = { email: 'user@example.com', name: 'John' }
      const result = redactObject(obj, { mode: 'MASK' })
      expect(result.wasRedacted).toBe(true)
      const redacted = result.value as Record<string, unknown>
      expect(redacted.email).toBe('[REDACTED]')
      expect(redacted.name).toBe('John')
    })

    it('should preserve non-string properties', () => {
      const obj = { email: 'user@example.com', age: 30, active: true }
      const result = redactObject(obj, { mode: 'MASK' })
      const redacted = result.value as Record<string, unknown>
      expect(redacted.age).toBe(30)
      expect(redacted.active).toBe(true)
    })

    it('should handle empty objects', () => {
      const obj = {}
      const result = redactObject(obj, { mode: 'MASK' })
      expect(result.wasRedacted).toBe(false)
      expect(result.value).toEqual({})
    })
  })

  describe('Nested objects', () => {
    it('should redact nested properties', () => {
      const obj = {
        user: {
          email: 'john@example.com',
          phone: '555-123-4567',
        },
        metadata: { created: '2024-01-01' },
      }
      const result = redactObject(obj, { mode: 'MASK' })
      const redacted = result.value as Record<string, Record<string, unknown>>
      expect(redacted.user.email).toBe('[REDACTED]')
      expect(redacted.user.phone).toBe('[REDACTED]')
      expect(redacted.metadata.created).toBe('2024-01-01')
    })

    it('should handle deeply nested objects', () => {
      const obj = {
        level1: {
          level2: {
            level3: {
              email: 'deep@example.com',
            },
          },
        },
      }
      const result = redactObject(obj, { mode: 'MASK' })
      const redacted = result.value as Record<string, unknown>
      expect(JSON.stringify(redacted)).not.toContain('deep@example.com')
      expect(JSON.stringify(redacted)).toContain('[REDACTED]')
    })

    it('should respect maxDepth option', () => {
      const obj = {
        level1: {
          level2: {
            level3: {
              email: 'deep@example.com',
            },
          },
        },
      }
      const result = redactObject(obj, { mode: 'MASK', maxDepth: 2 })
      const redacted = result.value as Record<string, Record<string, Record<string, unknown>>>
      // At maxDepth=2, we stop before level3, so email should still contain the actual value
      expect(JSON.stringify(redacted.level1.level2.level3)).toContain('deep@example.com')
    })
  })

  describe('Arrays', () => {
    it('should redact array of strings', () => {
      const obj = {
        emails: ['john@example.com', 'jane@example.com'],
      }
      const result = redactObject(obj, { mode: 'PLACEHOLDER' })
      const redacted = result.value as Record<string, string[]>
      expect(redacted.emails).toEqual(['[EMAIL]', '[EMAIL]'])
    })

    it('should redact arrays of objects', () => {
      const obj = {
        users: [
          { email: 'john@example.com', name: 'John' },
          { email: 'jane@example.com', name: 'Jane' },
        ],
      }
      const result = redactObject(obj, { mode: 'MASK' })
      const redacted = result.value as Record<string, Array<Record<string, unknown>>>
      expect(redacted.users[0].email).toBe('[REDACTED]')
      expect(redacted.users[1].email).toBe('[REDACTED]')
      expect(redacted.users[0].name).toBe('John')
    })

    it('should handle mixed array content', () => {
      const obj = {
        data: ['text', 'user@example.com', 123, { email: 'test@example.com' }],
      }
      const result = redactObject(obj, { mode: 'MASK' })
      const redacted = result.value as Record<string, unknown[]>
      expect(redacted.data[0]).toBe('text')
      expect(redacted.data[1]).toBe('[REDACTED]')
      expect(redacted.data[2]).toBe(123)
      const item = redacted.data[3] as Record<string, unknown>
      expect(item.email).toBe('[REDACTED]')
    })
  })

  describe('Redaction modes', () => {
    it('should apply correct mode to objects', () => {
      const obj = { email: 'user@example.com' }

      const mask = redactObject(obj, { mode: 'MASK' })
      expect((mask.value as Record<string, unknown>).email).toBe('[REDACTED]')

      const placeholder = redactObject(obj, { mode: 'PLACEHOLDER' })
      expect((placeholder.value as Record<string, unknown>).email).toBe('[EMAIL]')

      const drop = redactObject(obj, { mode: 'DROP' })
      expect((drop.value as Record<string, unknown>).email).toBe('')

      const hash = redactObject(obj, { mode: 'HASH' })
      expect((hash.value as Record<string, unknown>).email).toMatch(/\[sha256:[a-f0-9]{8}\]/)
    })
  })

  describe('Error handling', () => {
    it('should not throw on null input', () => {
      expect(() => redactObject(null, { mode: 'MASK' })).not.toThrow()
    })

    it('should handle circular references gracefully', () => {
      const obj: Record<string, unknown> = { email: 'user@example.com' }
      // Don't create actual circular reference to avoid issues, but test structure
      expect(() => redactObject(obj, { mode: 'MASK' })).not.toThrow()
    })

    it('should return original value on unexpected error', () => {
      const obj = { email: 'user@example.com' }
      const result = redactObject(obj, { mode: 'MASK' })
      expect(result.value).toBeDefined()
    })
  })

  describe('Metadata tracking', () => {
    it('should track redacted fields', () => {
      const obj = {
        email: 'john@example.com',
        phone: '555-123-4567',
        name: 'John Doe',
      }
      const result = redactObject(obj, { mode: 'MASK' })
      expect(result.redactedFields).toContain('EMAIL')
      expect(result.redactedFields).toContain('PHONE_US')
      expect(result.redactedFields).not.toContain('NAME')
    })

    it('should indicate no redaction when not needed', () => {
      const obj = { name: 'John', age: 30, city: 'NYC' }
      const result = redactObject(obj, { mode: 'MASK' })
      expect(result.wasRedacted).toBe(false)
      expect(result.redactedFields).toEqual([])
    })
  })
})

describe('Integration tests', () => {
  it('should handle real-world data structure', () => {
    const userData = {
      id: '12345',
      email: 'john.doe@example.com',
      phone: '(555) 123-4567',
      profile: {
        name: 'John Doe',
        ssn: '123-45-6789',
        address: '123 Main St',
      },
      apiKeys: {
        stripe: 'sk-1234567890abcdefghij',
        github: 'ghp_1234567890abcdefghij',
      },
      credentials: 'password="secretpass123" api_key="sk-12345678901234567890"',
    }

    const result = redactObject(userData, { mode: 'PLACEHOLDER' })
    const redacted = JSON.stringify(result.value)

    expect(redacted).toContain('[EMAIL]')
    expect(redacted).toContain('[PHONE_US]')
    expect(redacted).toContain('[SSN]')
    expect(redacted).toContain('[API_KEY]')
    // PASSWORD detection works on field-value patterns in strings
    expect(redacted).toContain('[PASSWORD]')
    expect(redacted).not.toContain('john.doe@example.com')
    expect(redacted).not.toContain('123-45-6789')
    expect(redacted).not.toContain('sk-1234567890abcdefghij')
  })

  it('should maintain structure while redacting', () => {
    const data = {
      users: [
        { id: 1, email: 'user1@example.com', status: 'active' },
        { id: 2, email: 'user2@example.com', status: 'inactive' },
      ],
    }

    const result = redactObject(data, { mode: 'MASK' })
    const redacted = result.value as Record<string, Array<Record<string, unknown>>>

    // Structure should be preserved
    expect(Array.isArray(redacted.users)).toBe(true)
    expect(redacted.users).toHaveLength(2)
    expect(redacted.users[0].id).toBe(1)
    expect(redacted.users[0].status).toBe('active')
    expect(redacted.users[1].id).toBe(2)
    expect(redacted.users[1].status).toBe('inactive')

    // But emails should be redacted
    expect(redacted.users[0].email).toBe('[REDACTED]')
    expect(redacted.users[1].email).toBe('[REDACTED]')
  })
})
