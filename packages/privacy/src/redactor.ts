import { createHash } from 'crypto'
import {
  detectEmail,
  detectApiKey,
  detectCreditCard,
  detectPhoneUS,
  detectSSN,
  detectPassword,
  type DetectionResult,
} from './detectors.js'

/**
 * PII redaction mode.
 * - MASK: Replace with [REDACTED]
 * - HASH: Replace with [sha256:first8chars]
 * - DROP: Replace with empty string
 * - PLACEHOLDER: Replace with [TYPE]
 */
export type RedactionMode = 'MASK' | 'HASH' | 'DROP' | 'PLACEHOLDER'

/**
 * Options for redaction behavior.
 */
export interface RedactionOptions {
  /** Redaction mode to use */
  mode: RedactionMode
  /** Maximum depth for recursive object redaction (default: 10) */
  maxDepth?: number
}

/**
 * Result of a redaction operation.
 */
export interface RedactionResult {
  /** The redacted value */
  value: unknown
  /** Whether redaction was performed */
  wasRedacted: boolean
  /** Fields that were redacted (for objects/arrays) */
  redactedFields?: string[]
}

/**
 * Applies PII redaction to a string value.
 * Runs all detectors and replaces matches per the redaction mode.
 *
 * @param input - The string to redact
 * @param options - Redaction options
 * @returns Redaction result with redacted value and metadata
 *
 * @example
 * ```typescript
 * const result = redactString('My email is john@example.com', { mode: 'MASK' })
 * // result.value === 'My email is [REDACTED]'
 * // result.wasRedacted === true
 * ```
 */
export function redactString(input: string, options: RedactionOptions): RedactionResult {
  try {
    // Collect all PII matches from all detectors
    const allMatches: DetectionResult[] = []
    allMatches.push(...detectEmail(input))
    allMatches.push(...detectApiKey(input))
    allMatches.push(...detectCreditCard(input))
    allMatches.push(...detectPhoneUS(input))
    allMatches.push(...detectSSN(input))
    allMatches.push(...detectPassword(input))

    if (allMatches.length === 0) {
      return { value: input, wasRedacted: false }
    }

    // Sort matches by start position (reverse order to avoid index shifting)
    allMatches.sort((a, b) => b.start - a.start)

    let result = input
    for (const match of allMatches) {
      const replacement = getRedactionReplacement(match.value, match.type, options.mode)
      result = result.substring(0, match.start) + replacement + result.substring(match.end)
    }

    return {
      value: result,
      wasRedacted: true,
      redactedFields: allMatches.map((m) => m.type),
    }
  } catch {
    return { value: input, wasRedacted: false }
  }
}

/**
 * Applies PII redaction to an object recursively.
 * Redacts string values that contain PII.
 *
 * @param obj - The object to redact
 * @param options - Redaction options
 * @returns Redaction result with redacted object and metadata
 *
 * @example
 * ```typescript
 * const result = redactObject(
 *   { user: 'john@example.com', age: 30 },
 *   { mode: 'MASK' }
 * )
 * // result.value === { user: '[REDACTED]', age: 30 }
 * ```
 */
export function redactObject(
  obj: unknown,
  options: RedactionOptions,
): RedactionResult {
  try {
    const maxDepth = options.maxDepth ?? 10
    const redactedFields: string[] = []

    const redacted = redactRecursive(obj, maxDepth, redactedFields, options.mode)

    return {
      value: redacted,
      wasRedacted: redactedFields.length > 0,
      redactedFields,
    }
  } catch {
    return { value: obj, wasRedacted: false }
  }
}

/**
 * Recursively redacts PII from objects and arrays.
 */
function redactRecursive(
  value: unknown,
  depth: number,
  redactedFields: string[],
  mode: RedactionMode,
): unknown {
  if (depth <= 0) {
    return value
  }

  if (typeof value === 'string') {
    const result = redactString(value, { mode })
    if (result.wasRedacted && result.redactedFields) {
      redactedFields.push(...result.redactedFields)
    }
    return result.value
  }

  if (Array.isArray(value)) {
    return value.map((item) => redactRecursive(item, depth - 1, redactedFields, mode))
  }

  if (value !== null && typeof value === 'object') {
    const obj = value as Record<string, unknown>
    const result: Record<string, unknown> = {}

    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        result[key] = redactRecursive(obj[key], depth - 1, redactedFields, mode)
      }
    }

    return result
  }

  return value
}

/**
 * Gets the redaction replacement string for a value based on the mode.
 */
function getRedactionReplacement(value: string, type: string, mode: RedactionMode): string {
  switch (mode) {
    case 'MASK':
      return '[REDACTED]'

    case 'HASH': {
      const hash = createHash('sha256').update(value).digest('hex')
      return `[sha256:${hash.substring(0, 8)}]`
    }

    case 'DROP':
      return ''

    case 'PLACEHOLDER':
      return `[${type}]`

    default:
      return '[REDACTED]'
  }
}
