/**
 * PII (Personally Identifiable Information) detectors.
 * Pure functions that identify sensitive data patterns in strings.
 */

/**
 * Represents a detected PII match with its location and type.
 */
export interface DetectionResult {
  value: string
  start: number
  end: number
  type: string
}

/**
 * Detects email addresses in a string.
 * Pattern: standard email format (local@domain.ext)
 */
export function detectEmail(input: string): DetectionResult[] {
  try {
    const results: DetectionResult[] = []
    // Standard email regex - TLD limited to 2-4 chars to avoid matching into following text
    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,4}(?![a-zA-Z])/g
    let match

    while ((match = emailRegex.exec(input)) !== null) {
      results.push({
        value: match[0],
        start: match.index,
        end: match.index + match[0].length,
        type: 'EMAIL',
      })
    }

    return results
  } catch {
    return []
  }
}

/**
 * Detects API keys in a string.
 * Pattern: strings starting with sk-, ak-, pk-, or Bearer token prefix
 */
export function detectApiKey(input: string): DetectionResult[] {
  try {
    const results: DetectionResult[] = []
    // Match API keys starting with common prefixes
    const apiKeyRegex = /(sk-[a-zA-Z0-9_-]{20,}|ak-[a-zA-Z0-9_-]{20,}|pk-[a-zA-Z0-9_-]{20,}|Bearer\s+[a-zA-Z0-9._-]+)/g
    let match

    while ((match = apiKeyRegex.exec(input)) !== null) {
      results.push({
        value: match[0],
        start: match.index,
        end: match.index + match[0].length,
        type: 'API_KEY',
      })
    }

    return results
  } catch {
    return []
  }
}

/**
 * Detects credit card numbers using the Luhn algorithm.
 * Pattern: 13-19 digit sequences that pass Luhn validation
 */
export function detectCreditCard(input: string): DetectionResult[] {
  try {
    const results: DetectionResult[] = []
    // Match sequences of 13-19 digits
    const cardRegex = /\b\d{13,19}\b/g
    let match

    while ((match = cardRegex.exec(input)) !== null) {
      const cardNumber = match[0]
      // Verify using Luhn algorithm
      if (luhnCheck(cardNumber)) {
        results.push({
          value: cardNumber,
          start: match.index,
          end: match.index + cardNumber.length,
          type: 'CREDIT_CARD',
        })
      }
    }

    return results
  } catch {
    return []
  }
}

/**
 * Validates a credit card number using the Luhn algorithm.
 */
function luhnCheck(num: string): boolean {
  let sum = 0
  let isEven = false

  for (let i = num.length - 1; i >= 0; i--) {
    let digit = parseInt(num.charAt(i), 10)

    if (isEven) {
      digit *= 2
      if (digit > 9) {
        digit -= 9
      }
    }

    sum += digit
    isEven = !isEven
  }

  return sum % 10 === 0
}

/**
 * Detects US phone numbers in a string.
 * Patterns: (123) 456-7890, 123-456-7890, 123.456.7890, 1234567890
 */
export function detectPhoneUS(input: string): DetectionResult[] {
  try {
    const results: DetectionResult[] = []
    // Match various US phone number formats
    const phoneRegex = /(\(\d{3}\)\s*\d{3}[-.\s]?\d{4}|\d{3}[-.\s]?\d{3}[-.\s]?\d{4}|\b\d{10}\b)/g
    let match

    while ((match = phoneRegex.exec(input)) !== null) {
      results.push({
        value: match[0],
        start: match.index,
        end: match.index + match[0].length,
        type: 'PHONE_US',
      })
    }

    return results
  } catch {
    return []
  }
}

/**
 * Detects US Social Security Numbers.
 * Pattern: XXX-XX-XXXX or XXXXXXXXX
 */
export function detectSSN(input: string): DetectionResult[] {
  try {
    const results: DetectionResult[] = []
    // Match SSN format: XXX-XX-XXXX or XXXXXXXXX
    const ssnRegex = /\b\d{3}-\d{2}-\d{4}\b|\b\d{9}\b/g
    let match

    while ((match = ssnRegex.exec(input)) !== null) {
      // Avoid matching sequences that look like dates (MM-DD-YYYY pattern)
      if (!/^\d{4}-\d{2}-\d{4}$/.test(match[0])) {
        results.push({
          value: match[0],
          start: match.index,
          end: match.index + match[0].length,
          type: 'SSN',
        })
      }
    }

    return results
  } catch {
    return []
  }
}

/**
 * Detects password fields and values in object notation.
 * Pattern: JSON/object fields named password, passwd, secret, token with their values
 */
export function detectPassword(input: string): DetectionResult[] {
  try {
    const results: DetectionResult[] = []
    // Match various password field patterns: "password": "value", password=value, etc.
    const passwordRegex = /(["']?)(?:password|passwd|secret|token)(["']?)\s*[:=]\s*["']?([^"',\s}]+)["']?/gi
    let match

    while ((match = passwordRegex.exec(input)) !== null) {
      // Capture the value part (group 3)
      if (match[3]) {
        const valueStart = match.index + match[0].indexOf(match[3])
        results.push({
          value: match[3],
          start: valueStart,
          end: valueStart + match[3].length,
          type: 'PASSWORD',
        })
      }
    }

    return results
  } catch {
    return []
  }
}

/**
 * Runs all PII detectors on the input string.
 * Returns all detected PII matches from all detector types.
 */
export function detectAllPII(input: string): DetectionResult[] {
  const results: DetectionResult[] = []

  // Run all detectors
  results.push(...detectEmail(input))
  results.push(...detectApiKey(input))
  results.push(...detectCreditCard(input))
  results.push(...detectPhoneUS(input))
  results.push(...detectSSN(input))
  results.push(...detectPassword(input))

  // Sort by start position
  return results.sort((a, b) => a.start - b.start)
}
