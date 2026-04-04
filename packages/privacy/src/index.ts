/**
 * @agentlens/privacy — Privacy engine with PII detection and redaction
 * Automatically detects and redacts personally identifiable information.
 */

export {
  detectEmail,
  detectApiKey,
  detectCreditCard,
  detectPhoneUS,
  detectSSN,
  detectPassword,
  detectAllPII,
  type DetectionResult,
} from './detectors.js'
