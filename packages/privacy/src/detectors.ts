/**
 * PII (Personally Identifiable Information) detectors.
 * Pure functions that identify sensitive data patterns in strings.
 */

/**
 * Represents a detected PII match with its location, type, and confidence.
 * Confidence helps callers decide whether to redact based on certainty.
 */
export interface DetectionResult {
  value: string
  start: number
  end: number
  type: string
  /** Confidence level: HIGH for patterns with low false positive rate, MEDIUM for ambiguous patterns */
  confidence: 'HIGH' | 'MEDIUM'
}

/**
 * Detects email addresses in a string.
 * Pattern: standard email format (local@domain.ext)
 * Uses RFC 5322-compliant pattern (simplified version safe for production).
 */
export function detectEmail(input: string): DetectionResult[] {
  try {
    const results: DetectionResult[] = []
    // RFC 5322 simplified: matches most valid email addresses
    // Pattern allows: alphanumeric, dots, underscores, hyphens, plus signs
    // Requires at least 1 char, @, domain with at least 1 char, dot, and TLD of 2+ chars
    const emailRegex = /[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*\.[a-zA-Z]{2,}/g
    let match

    while ((match = emailRegex.exec(input)) !== null) {
      results.push({
        value: match[0],
        start: match.index,
        end: match.index + match[0].length,
        type: 'EMAIL',
        confidence: 'HIGH',
      })
    }

    return results
  } catch {
    return []
  }
}

/**
 * Detects API keys in a string.
 * Pattern: strings starting with common prefixes (sk-, ak-, pk-, Bearer, etc.) or
 * known API key formats (e.g., authorization headers, token= patterns).
 */
export function detectApiKey(input: string): DetectionResult[] {
  try {
    const results: DetectionResult[] = []

    // HIGH confidence patterns: explicit API key prefixes and Bearer tokens
    const highConfidenceRegex = /(sk-[a-zA-Z0-9_-]{20,}|ak-[a-zA-Z0-9_-]{20,}|pk-[a-zA-Z0-9_-]{20,}|rk-[a-zA-Z0-9_-]{20,}|Bearer\s+[a-zA-Z0-9._\-]+)/g
    let match: RegExpExecArray | null

    while ((match = highConfidenceRegex.exec(input)) !== null) {
      results.push({
        value: match[0],
        start: match.index,
        end: match.index + match[0].length,
        type: 'API_KEY',
        confidence: 'HIGH',
      })
    }

    // MEDIUM confidence patterns: generic token= or apikey= patterns
    const mediumConfidenceRegex = /(?:api[_-]?key|auth(?:orization)?|token|access[_-]?token)\s*[:=]\s*["']?([a-zA-Z0-9._\-]+)["']?/gi

    let mediumMatch: RegExpExecArray | null
    while ((mediumMatch = mediumConfidenceRegex.exec(input)) !== null) {
      // Avoid duplicates with high confidence matches
      const isDuplicate = results.some(r => r.start === mediumMatch!.index)
      const capturedValue = mediumMatch![1]
      if (!isDuplicate && capturedValue && capturedValue.length > 5) {
        results.push({
          value: capturedValue,
          start: mediumMatch!.index + mediumMatch![0].indexOf(capturedValue),
          end: mediumMatch!.index + mediumMatch![0].indexOf(capturedValue) + capturedValue.length,
          type: 'API_KEY',
          confidence: 'MEDIUM',
        })
      }
    }

    return results
  } catch {
    return []
  }
}

/**
 * Detects credit card numbers using the Luhn algorithm.
 * Pattern: 13-19 digit sequences that pass Luhn validation.
 * HIGH confidence: valid Luhn checksum + known card length (13, 15, or 16 digits).
 * MEDIUM confidence: passes Luhn but unusual length.
 */
export function detectCreditCard(input: string): DetectionResult[] {
  try {
    const results: DetectionResult[] = []
    // Match sequences of 13-19 digits (with optional spaces/dashes for formatted cards)
    const cardRegex = /\b(?:\d{4}[\s-]?){3}\d{4}\b|\b\d{13,19}\b/g
    let match

    while ((match = cardRegex.exec(input)) !== null) {
      // Remove spaces and dashes for validation
      const cardNumber = match[0].replace(/[\s-]/g, '')

      // Skip if not all digits
      if (!/^\d+$/.test(cardNumber)) {
        continue
      }

      // Verify using Luhn algorithm
      if (luhnCheck(cardNumber)) {
        // HIGH confidence for standard card lengths (13, 15, 16)
        const confidence = [13, 15, 16].includes(cardNumber.length) ? 'HIGH' : 'MEDIUM'

        results.push({
          value: match[0],
          start: match.index,
          end: match.index + match[0].length,
          type: 'CREDIT_CARD',
          confidence,
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
 * Patterns: (123) 456-7890, 123-456-7890, 123.456.7890, 1234567890, +1-123-456-7890
 * MEDIUM confidence: can produce false positives with similar digit patterns.
 */
export function detectPhoneUS(input: string): DetectionResult[] {
  try {
    const results: DetectionResult[] = []
    // Match various US phone number formats including international prefix
    const phoneRegex = /(?:\+1[-.\s]?)?(\(\d{3}\)[-.\s]?\d{3}[-.\s]?\d{4}|\d{3}[-.\s]\d{3}[-.\s]\d{4}|\b\d{10}\b)/g
    let match: RegExpExecArray | null

    while ((match = phoneRegex.exec(input)) !== null) {
      results.push({
        value: match[0],
        start: match.index,
        end: match.index + match[0].length,
        type: 'PHONE_US',
        confidence: 'MEDIUM', // Can produce false positives
      })
    }

    return results
  } catch {
    return []
  }
}

/**
 * Detects US Social Security Numbers.
 * Pattern: XXX-XX-XXXX (high confidence) or XXXXXXXXX (medium confidence).
 * SSNs have invalid ranges: first group cannot be 000, 666, or 900-999.
 */
export function detectSSN(input: string): DetectionResult[] {
  try {
    const results: DetectionResult[] = []

    // HIGH confidence: formatted XXX-XX-XXXX with invalid range checks
    const ssnFormattedRegex = /\b(\d{3})-(\d{2})-(\d{4})\b/g
    let match: RegExpExecArray | null

    while ((match = ssnFormattedRegex.exec(input)) !== null) {
      const areaNumber = parseInt(match[1] ?? '', 10)

      // SSNs are invalid if area number is 000, 666, or 900-999
      if (areaNumber !== 0 && areaNumber !== 666 && areaNumber < 900) {
        results.push({
          value: match[0],
          start: match.index,
          end: match.index + match[0].length,
          type: 'SSN',
          confidence: 'HIGH',
        })
      }
    }

    // MEDIUM confidence: 9 consecutive digits
    // This can produce false positives so treat with lower confidence
    const ssnUnformattedRegex = /\b\d{9}\b/g

    while ((match = ssnUnformattedRegex.exec(input)) !== null) {
      // Avoid matching sequences that are clearly not SSNs (dates, IDs, etc.)
      if (!/^\d{4}\d{2}\d{4}$|^\d{8}\d$/.test(match[0])) {
        results.push({
          value: match[0],
          start: match.index,
          end: match.index + match[0].length,
          type: 'SSN',
          confidence: 'MEDIUM',
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
 * Pattern: JSON/object fields named password, passwd, secret, token, etc. with their values.
 * HIGH confidence: explicit password/secret/token fields.
 * MEDIUM confidence: generic auth-related fields.
 */
export function detectPassword(input: string): DetectionResult[] {
  try {
    const results: DetectionResult[] = []

    // HIGH confidence: explicit password, secret, or token fields
    const highConfidenceRegex = /(["']?)(?:password|passwd|secret|api[_-]?key|private[_-]?key)(["']?)\s*[:=]\s*["']?([^"',\s}\]]+)["']?/gi
    let match: RegExpExecArray | null

    while ((match = highConfidenceRegex.exec(input)) !== null) {
      const capturedValue = match[3]
      if (capturedValue && capturedValue.length > 0) {
        const valueStart = match.index + match[0].indexOf(capturedValue)
        results.push({
          value: capturedValue,
          start: valueStart,
          end: valueStart + capturedValue.length,
          type: 'PASSWORD',
          confidence: 'HIGH',
        })
      }
    }

    // MEDIUM confidence: auth, token, credentials fields (more generic)
    const mediumConfidenceRegex = /(["']?)(?:auth(?:orization)?|auth[_-]?token|access[_-]?token|refresh[_-]?token|credentials?)(["']?)\s*[:=]\s*["']?([^"',\s}\]]+)["']?/gi

    let mediumMatch: RegExpExecArray | null
    while ((mediumMatch = mediumConfidenceRegex.exec(input)) !== null) {
      const capturedValue = mediumMatch[3]
      if (capturedValue && capturedValue.length > 0) {
        // Avoid duplicates
        const valueStart = mediumMatch.index + mediumMatch[0].indexOf(capturedValue)
        const isDuplicate = results.some(r => r.start === valueStart)

        if (!isDuplicate) {
          results.push({
            value: capturedValue,
            start: valueStart,
            end: valueStart + capturedValue.length,
            type: 'PASSWORD',
            confidence: 'MEDIUM',
          })
        }
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
