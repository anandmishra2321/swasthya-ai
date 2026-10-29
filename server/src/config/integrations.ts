import { env } from './env';

/**
 * Truthful integration status.
 *
 * Optional integrations report `configured: false` unless real credentials are
 * present, so the UI can show a "Not Configured" state instead of pretending
 * an integration is live.
 */
export interface IntegrationStatus {
  configured: boolean;
  provider: string;
  /** What the operator must supply for this to become live. */
  requires?: string;
  /** Human-readable current behaviour. */
  mode: string;
}

export interface IntegrationsReport {
  ai: IntegrationStatus;
  email: IntegrationStatus;
  maps: IntegrationStatus;
  sms: IntegrationStatus;
  wearables: {
    /** A web build can only ever use Web Bluetooth, and only on Chromium. */
    webBluetooth: IntegrationStatus;
    appleHealth: IntegrationStatus;
    healthConnect: IntegrationStatus;
    vendorCloudOAuth: IntegrationStatus;
  };
  ambulanceDispatch: IntegrationStatus;
  payments: IntegrationStatus;
}

function opt(provider: string, hasCredential: boolean, mode: string, requires: string): IntegrationStatus {
  return {
    configured: hasCredential,
    provider,
    requires: hasCredential ? undefined : requires,
    mode: hasCredential ? mode : 'Not Configured',
  };
}

export function getIntegrationsReport(): IntegrationsReport {
  const mapsConfigured = !!env.MAP_API_KEY;

  return {
    ai: {
      configured: env.AI_PROVIDER === 'gemini' && !!env.AI_API_KEY,
      provider: env.AI_PROVIDER,
      requires: env.AI_PROVIDER === 'gemini' && env.AI_API_KEY ? undefined : 'An implemented AI provider adapter and provider credentials',
      mode: env.AI_PROVIDER === 'gemini' && env.AI_API_KEY
        ? 'Live Gemini AI provider'
        : env.AI_PROVIDER === 'mock' && env.NODE_ENV !== 'production'
        ? 'Development-only deterministic demo; no live AI provider'
        : 'Not Configured',
    },
    email: {
      configured: false,
      provider: env.EMAIL_PROVIDER,
      requires: 'An implemented email delivery adapter and verified provider credentials',
      mode: 'Not Implemented',
    },
    maps: opt(
      'openstreetmap / nominatim',
      true,
      mapsConfigured
        ? 'OpenStreetMap with Google Places fallback'
        : 'OpenStreetMap Overpass + Nominatim (no key required)',
      'MAP_API_KEY for Google Places fallback'
    ),
    sms: opt('none', false, 'Not available', 'SMS_PROVIDER credentials (e.g. Twilio/MSG91)'),
    wearables: {
      // Implemented in-app against the real browser Web Bluetooth API.
      webBluetooth: {
        configured: true,
        provider: 'Web Bluetooth (Chromium only)',
        mode: 'Live when the browser supports Web Bluetooth and the user pairs a device',
      },
      appleHealth: opt(
        'HealthKit',
        false,
        'Not available',
        'An iOS companion app — HealthKit cannot be read from a web page'
      ),
      healthConnect: opt(
        'Android Health Connect',
        false,
        'Not available',
        'A native Android wrapper app with Health Connect permissions'
      ),
      vendorCloudOAuth: opt(
        'Fitbit / Garmin / Samsung',
        false,
        'Not available',
        'Developer approval, OAuth client id/secret and vendor scopes'
      ),
    },
    ambulanceDispatch: opt(
      'none',
      false,
      'Directory only',
      'An authorized state ambulance dispatch integration (e.g. 108/EMRI feed)'
    ),
    payments: opt('none', false, 'Not available', 'A payment gateway account and server-side keys'),
  };
}
