/**
 * Structured logger with secret/PHI redaction.
 *
 * Never log raw health data, tokens, passwords or full request bodies.
 */

const REDACTED = '[REDACTED]';

/** Exact key matches that always carry secrets. */
const SECRET_KEYS =
  /^(password|passwd|pwd|secret|token|access_?token|refresh_?token|authorization|api_?key|cookie|otp|set-cookie)$/i;

/** Substring matches that indicate a secret-bearing key. */
const SECRET_SUBSTRINGS = /(password|passwd|secret|token|api_?key|apikey|cookie|privatekey)/i;

/** Government / payment identifiers. */
const IDENTIFIER_KEYS = /(aadhaar|aadhar|ssn|cvv|card_?number|pan_?number)/i;

/** Clinical / health values (PHI) that must not be logged in the clear. */
const PHI_KEYS =
  /^(diagnosis|symptoms?|clinical_?notes?|notes?|allergies|medications?|prescriptions?|lab_?results?|results?|heart_?rate|spo2|glucose|temperature|body)$/i;

function isSensitiveKey(key: string): boolean {
  if (SECRET_KEYS.test(key)) return true;
  if (SECRET_SUBSTRINGS.test(key)) return true;
  if (IDENTIFIER_KEYS.test(key)) return true;
  if (PHI_KEYS.test(key)) return true;
  return false;
}

function redactValue(value: unknown, depth = 0): unknown {
  if (value === null || value === undefined) return value;
  if (depth > 4) return '[TRUNCATED]';
  if (Array.isArray(value)) return value.slice(0, 20).map((v) => redactValue(v, depth + 1));
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = isSensitiveKey(k) ? REDACTED : redactValue(v, depth + 1);
    }
    return out;
  }
  if (typeof value === 'string' && value.length > 300) return `${value.slice(0, 300)}…[TRUNCATED]`;
  return value;
}

/** Redacts sensitive fields from an arbitrary payload before logging. */
export function redact(payload: unknown): unknown {
  return redactValue(payload);
}

type Level = 'info' | 'warn' | 'error';

function emit(level: Level, message: string, context?: Record<string, unknown>): void {
  const line = {
    ts: new Date().toISOString(),
    level,
    service: 'swasthya-api',
    message,
    ...(context ? { context: redact(context) as Record<string, unknown> } : {}),
  };
  const serialized = JSON.stringify(line);
  if (level === 'error') console.error(serialized);
  else if (level === 'warn') console.warn(serialized);
  else console.log(serialized);
}

export const logger = {
  info: (message: string, context?: Record<string, unknown>) => emit('info', message, context),
  warn: (message: string, context?: Record<string, unknown>) => emit('warn', message, context),
  error: (message: string, context?: Record<string, unknown>) => emit('error', message, context),
};
