# AgentLens Security Policy

## Security Overview

AgentLens prioritizes privacy and security in AI agent observability. This document describes the security measures implemented in AgentLens v1.0.0 and how to use them safely in your applications.

## PII Detection and Redaction

### Automatic PII Detection

AgentLens automatically detects and redacts Personally Identifiable Information (PII) before logging. The following data types are detected:

| Data Type | Detection Pattern | Confidence |
|-----------|------------------|-----------|
| Email | RFC 5322 email format | HIGH |
| API Keys | `sk-`, `ak-`, `pk-`, `Bearer` tokens, `apikey=` patterns | HIGH/MEDIUM |
| Credit Cards | 13-19 digit sequences + Luhn validation, with optional formatting | HIGH/MEDIUM |
| Phone Numbers | US phone formats: `(123) 456-7890`, `123-456-7890`, etc. | MEDIUM |
| SSN | US Social Security format: `XXX-XX-XXXX` with range validation | HIGH |
| Passwords | Fields named `password`, `passwd`, `secret`, `token`, `credentials` | HIGH/MEDIUM |

### Redaction Modes

Configure redaction behavior with the `mode` option:

- **MASK** (default): Replace with `[REDACTED]`
- **HASH**: Replace with `[sha256:first8chars]` (deterministic hashing for correlation)
- **DROP**: Remove entirely
- **PLACEHOLDER**: Replace with `[TYPE]` e.g., `[EMAIL]`

### Example Configuration

```typescript
const lens = new AgentLens({
  agent: 'MyBot',
  transport: 'console',
  privacy: {
    enabled: true,
    redactionMode: 'MASK'
  }
})
```

### Confidence Levels and False Positives

Detectors report a confidence level (`HIGH` or `MEDIUM`):

- **HIGH**: Strong pattern match with low false positive rate (emails, formatted SSNs, API key prefixes)
- **MEDIUM**: Good match but may have false positives (bare 9-digit SSNs, phone numbers, generic tokens)

By default, both `HIGH` and `MEDIUM` confidence matches are redacted. To only redact high-confidence matches:

```typescript
// In redactor options - set minConfidence to 'HIGH'
// Note: This is available through the privacy package directly
```

## File Security

### Log File Permissions

AgentLens automatically sets secure file permissions when writing logs:

- **File Mode**: `0600` (read/write for owner only)
- **Applied to**: All log files and rotated archives

This prevents other users on the same system from reading sensitive agent execution logs.

**Important**: Run AgentLens with a dedicated service account to further isolate logs from other processes.

### Log File Rotation

Log files rotate automatically:

- **Default Size**: 50 MB
- **Max Retained Files**: 5 (configurable)
- **Format**: `agentlens.log`, `agentlens.1.log`, `agentlens.2.log`, etc.

Rotated files inherit the same `0600` permissions as active logs.

### Log Retention

**Best Practice**: Implement log retention policies based on your compliance requirements:

- **GDPR**: Consider retention periods for EU-based users
- **HIPAA**: If logging healthcare-related agent activities, follow retention rules
- **SOC 2**: Maintain audit trails for compliance periods (typically 6-12 months)

Example:

```bash
# Delete logs older than 30 days (implement this in your infrastructure)
find /var/log/agentlens -name "agentlens*.log" -mtime +30 -delete
```

## Error Messages and Stack Traces

### Stack Trace Redaction

Stack traces are automatically sanitized before logging:

- **File Paths**: Removed (e.g., `/home/user/project/src/` → removed)
- **Module Names**: Kept only for debugging context
- **Function Names**: Preserved for debugging
- **Line/Column Numbers**: Preserved for debugging

Example:

**Before**:
```
Error: Failed to fetch
  at async getUserData (/Users/alice/projects/ai-agent/src/api.ts:42:15)
  at async processRequest (/Users/alice/projects/ai-agent/src/index.ts:120:8)
```

**After**:
```
Error: Failed to fetch
  at async getUserData (api.ts:42:15)
  at async processRequest (index.ts:120:8)
```

This prevents leaking internal filesystem structure and developer names/paths.

## API Key and Credential Handling

### Best Practices

1. **Never hardcode API keys** in your application
2. **Use environment variables** or secure vaults for credentials
3. **AgentLens does not capture request headers** — API keys managed by SDKs are not logged by default

### What AgentLens Logs

- ✅ LLM model names, token counts, latencies
- ✅ Tool names, inputs, outputs (subject to redaction)
- ❌ API keys from request headers (not captured)
- ❌ Bearer tokens in Authorization headers (not captured)

### SDK-Managed Credentials

Anthropic and OpenAI SDKs manage credentials internally:

```typescript
const client = new Anthropic() // Uses ANTHROPIC_API_KEY env var
// API key is NOT in the messages.create() call parameters
// AgentLens does not have access to it
```

## Cost Estimation

### Model Cost Tables

AgentLens includes pre-configured cost tables for popular models:

**Anthropic Models** (per 1M tokens, USD):
- Claude Opus 4.x: $15.00 input, $75.00 output
- Claude Sonnet 4.x: $3.00 input, $15.00 output
- Claude Haiku 4.x: $0.80 input, $4.00 output

**OpenAI Models** (per 1M tokens, USD):
- GPT-4o: $2.50 input, $10.00 output
- GPT-4o Mini: $0.15 input, $0.60 output
- o1: $15.00 input, $60.00 output

### Unknown Models

If you use a model not in the cost table, AgentLens logs a warning:

```
[AgentLens] Warning: Cost estimation unavailable for model 'claude-custom-v2'.
Cost will be reported as $0.00. Update your cost tables in
packages/interceptors/src/costs.ts
```

**Costs are estimates only**. Actual billing may differ based on:
- Model version details
- Provider promotions or volume discounts
- Streaming token calculations

## Data Transmission

### Transport Layer

AgentLens writes events to configured transports (console, file, custom):

- **Console Transport**: Plain text or JSONL sent to stdout/stderr
- **File Transport**: JSONL written to disk with `0600` permissions
- **Custom Transport**: Your implementation

### Redaction Before Transport

**Important**: PII redaction always runs **before** events reach any transport. This is non-negotiable.

```
Event Built → Redaction → Transport Write
```

There is no configuration to disable redaction.

## Production Checklist

Before deploying AgentLens in production:

- [ ] File permissions: Verify `0600` on `agentlens.log*` files
- [ ] Log retention: Implement log cleanup (e.g., delete after 30 days)
- [ ] Monitoring: Set up alerts for `[AgentLens]` warnings in stderr
- [ ] Testing: Run with test credentials to verify redaction works
- [ ] Compliance: Review logs against your compliance requirements
- [ ] Access Control: Restrict filesystem access to log files
- [ ] Encryption: Consider integrating with encrypted filesystems for at-rest encryption

## Reporting Security Issues

If you discover a security vulnerability in AgentLens:

1. **Do not** open a public GitHub issue
2. Email security concerns to the maintainers (check the repository for SECURITY contact)
3. Provide details: type of vulnerability, affected versions, reproduction steps
4. Allow time for a fix before public disclosure

## Compliance Notes

### GDPR (EU General Data Protection Regulation)

- AgentLens supports PII redaction for compliance
- Implement log retention policies (consider < 30 days for user interactions)
- Document your data processing in privacy policies

### HIPAA (US Healthcare)

- If logging healthcare agent interactions, ensure:
  - PHI (Protected Health Information) is redacted
  - Logs are encrypted at rest
  - Access is audit-logged
  - Retention policies comply with HIPAA timelines

### SOC 2 Type II

- AgentLens file transport sets `0600` permissions (controls)
- Implement log rotation for auditability
- Monitor stderr for warnings and errors

## FAQ

### Q: Can I disable PII redaction?

**A**: No. Redaction is mandatory for all transports. This is by design—AgentLens is privacy-first.

### Q: Are logs encrypted in transit?

**A**: No. AgentLens doesn't encrypt transport writes. Use:
- SFTP/SSH for remote file storage
- Encrypted filesystems for local storage
- HTTPS/TLS for custom transports to remote services

### Q: What if a redaction pattern misses my PII?

**A**: Report it as a security issue (see above). In the meantime:
- Avoid logging sensitive data where possible
- Use custom redaction in your transport layer
- Sanitize inputs before passing to AgentLens

### Q: How do I know what was redacted?

**A**: The `privacy.redacted_fields` array in each ARLS event lists redacted types:

```json
{
  "privacy": {
    "pii_detected": true,
    "redacted_fields": ["EMAIL", "PASSWORD"]
  }
}
```

### Q: Can I integrate AgentLens with a secrets manager?

**A**: AgentLens doesn't manage secrets. Use environment variables or your secrets manager:

```typescript
const apiKey = process.env.ANTHROPIC_API_KEY // or: await vault.get('anthropic-key')
const client = new Anthropic({ apiKey })
const wrappedClient = lens.wrap(client)
```

The API key never touches AgentLens—it's managed entirely by the SDK.

---

**Version**: 1.0.0
**Last Updated**: 2024
**License**: MIT
