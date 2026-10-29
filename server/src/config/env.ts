import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const DEV_JWT_SECRET = 'swasthya-dev-jwt-super-secret-key-replace-in-production-32-chars';
const DEV_JWT_REFRESH_SECRET = 'swasthya-dev-jwt-refresh-secret-key-replace-in-production-32-chars';

export const env = {
  PORT: process.env.PORT ? parseInt(process.env.PORT, 10) : 5000,
  NODE_ENV: process.env.NODE_ENV || 'development',
  MONGODB_URI: process.env.MONGODB_URI || '',
  JWT_SECRET: process.env.JWT_SECRET || DEV_JWT_SECRET,
  JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET || DEV_JWT_REFRESH_SECRET,
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '2h',
  JWT_REFRESH_EXPIRES_IN: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  FRONTEND_ORIGIN: process.env.FRONTEND_ORIGIN || 'http://localhost:5173',
  AI_PROVIDER: process.env.AI_PROVIDER || 'mock',
  AI_API_KEY: process.env.AI_API_KEY || '',
  MAP_API_KEY: process.env.MAP_API_KEY || '',
  EMAIL_PROVIDER: process.env.EMAIL_PROVIDER || 'mock',
  EMAIL_FROM: process.env.EMAIL_FROM || 'notifications@swasthya-demo.local',
  SMTP_HOST: process.env.SMTP_HOST || '',
  SMTP_PORT: process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT, 10) : 587,
  SMTP_USER: process.env.SMTP_USER || '',
  SMTP_PASS: process.env.SMTP_PASS || '',
  SMS_PROVIDER: process.env.SMS_PROVIDER || 'none',
  STORAGE_DIR: process.env.STORAGE_DIR || path.resolve(__dirname, '../../uploads'),

  // Boot the zero-install demo with data: seed only when the database is empty
  // and never in production. Set SEED_ON_START=false to opt out.
  SEED_ON_START: process.env.SEED_ON_START === 'true' && (process.env.NODE_ENV || 'development') !== 'production',

  // Wearable platform OAuth (M6). Empty means the platform is reported as
  // "not configured" rather than silently mocked.
  FITBIT_CLIENT_ID: process.env.FITBIT_CLIENT_ID || '',
  FITBIT_CLIENT_SECRET: process.env.FITBIT_CLIENT_SECRET || '',
  FITBIT_REDIRECT_URI: process.env.FITBIT_REDIRECT_URI || 'http://localhost:5000/api/v1/wearables/fitbit/callback',

  // Payment Gateway (Razorpay)
  RAZORPAY_KEY_ID: process.env.RAZORPAY_KEY_ID || '',
  RAZORPAY_KEY_SECRET: process.env.RAZORPAY_KEY_SECRET || '',
  BOOTSTRAP_ADMIN_EMAIL: process.env.BOOTSTRAP_ADMIN_EMAIL || '',
  BOOTSTRAP_ADMIN_PASSWORD: process.env.BOOTSTRAP_ADMIN_PASSWORD || '',
  // Dev-only: allow role selection during public signup (disabled in production).
  ALLOW_ROLE_SIGNUP: process.env.ALLOW_ROLE_SIGNUP === 'true' && (process.env.NODE_ENV || 'development') !== 'production',
};

export interface EnvValidationIssue {
  variable: string;
  severity: 'error' | 'warn';
  message: string;
}

/**
 * Startup configuration validation.
 *
 * Hard failures (throwing) are reserved for production, where a weak secret or
 * a missing database would be a security or data-loss incident. In development
 * everything is reported as a warning so the zero-install demo still boots.
 */
export function validateEnv(): EnvValidationIssue[] {
  const issues: EnvValidationIssue[] = [];
  const isProd = env.NODE_ENV === 'production';

  if (env.JWT_SECRET === DEV_JWT_SECRET) {
    issues.push({
      variable: 'JWT_SECRET',
      severity: isProd ? 'error' : 'warn',
      message: 'Using the bundled development JWT secret.',
    });
  }
  if (env.JWT_REFRESH_SECRET === DEV_JWT_REFRESH_SECRET) {
    issues.push({
      variable: 'JWT_REFRESH_SECRET',
      severity: isProd ? 'error' : 'warn',
      message: 'Using the bundled development refresh secret.',
    });
  }
  if (env.JWT_SECRET.length < 32) {
    issues.push({ variable: 'JWT_SECRET', severity: 'error', message: 'Must be at least 32 characters.' });
  }
  if (isProd && !env.MONGODB_URI) {
    issues.push({
      variable: 'MONGODB_URI',
      severity: 'error',
      message: 'A persistent MongoDB URI is required in production (the in-memory fallback loses data).',
    });
  }
  if (isProd && env.AI_PROVIDER === 'mock') {
    issues.push({ variable: 'AI_PROVIDER', severity: 'warn', message: 'AI runs on the built-in mock engine.' });
  }
  if (isProd) {
    issues.push({
      variable: 'EMAIL_PROVIDER',
      severity: 'warn',
      message: 'No email delivery adapter is implemented; verification, invitations, and password resets are unavailable.',
    });
  }

  return issues;
}

/** Throws on fatal production misconfiguration, reports everything otherwise. */
export function assertEnvOrReport(logger: {
  info: (m: string, c?: Record<string, unknown>) => void;
  warn: (m: string, c?: Record<string, unknown>) => void;
  error: (m: string, c?: Record<string, unknown>) => void;
}): void {
  const issues = validateEnv();
  const fatal = issues.filter((i) => i.severity === 'error');

  for (const issue of fatal) {
    logger.error('Configuration error', { variable: issue.variable, message: issue.message });
  }
  for (const issue of issues.filter((i) => i.severity === 'warn')) {
    logger.warn('Configuration warning', { variable: issue.variable, message: issue.message });
  }

  if (env.NODE_ENV === 'production' && fatal.length > 0) {
    throw new Error(`Refusing to start: ${fatal.length} fatal configuration problem(s).`);
  }
}
