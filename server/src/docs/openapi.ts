/**
 * OpenAPI 3.0 description of the Swasthya AI REST API.
 *
 * Kept as a hand-maintained object (no build step) and served at
 * `GET /api/v1/openapi.json`, with a readable browser at `GET /api/docs`.
 *
 * Coverage note: every mounted route is listed with its auth requirement and
 * primary success/error codes. Request bodies reference the Zod-enforced shapes
 * implemented in `src/routes/*`.
 */

const errorEnvelope = {
  type: 'object',
  required: ['success', 'error'],
  properties: {
    success: { type: 'boolean', enum: [false] },
    error: {
      type: 'object',
      required: ['code', 'message'],
      properties: {
        code: {
          type: 'string',
          enum: [
            'VALIDATION_FAILED',
            'UNAUTHENTICATED',
            'FORBIDDEN',
            'NOT_FOUND',
            'CONFLICT',
            'RATE_LIMITED',
            'INTEGRATION_NOT_CONFIGURED',
            'UPSTREAM_UNAVAILABLE',
            'INTERNAL',
          ],
        },
        message: { type: 'string' },
        details: {},
      },
    },
    errorCode: { type: 'string' },
    requestId: { type: 'string' },
  },
};

const okEnvelope = {
  type: 'object',
  required: ['success', 'data'],
  properties: {
    success: { type: 'boolean', enum: [true] },
    data: {},
    meta: {
      type: 'object',
      properties: {
        requestId: { type: 'string' },
        page: { type: 'integer' },
        limit: { type: 'integer' },
        total: { type: 'integer' },
        totalPages: { type: 'integer' },
        hasNextPage: { type: 'boolean' },
        hasPrevPage: { type: 'boolean' },
      },
    },
    requestId: { type: 'string' },
  },
};

/** Standard error responses attached to protected operations. */
const commonErrors = {
  400: {
    description: 'VALIDATION_FAILED — request body, query or path failed validation.',
    content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorEnvelope' } } },
  },
  401: {
    description: 'UNAUTHENTICATED — missing, expired or revoked access token.',
    content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorEnvelope' } } },
  },
  403: {
    description: 'FORBIDDEN — authenticated but not authorized for this object or organization scope.',
    content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorEnvelope' } } },
  },
  404: {
    description: 'NOT_FOUND — resource does not exist or is not visible to the caller.',
    content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorEnvelope' } } },
  },
  409: {
    description: 'CONFLICT — violates a uniqueness or state-machine rule (e.g. double booking).',
    content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorEnvelope' } } },
  },
  500: {
    description: 'INTERNAL — unexpected server failure; see requestId in the response and the server logs.',
    content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorEnvelope' } } },
  },
};

const jsonOk = (description: string, dataSchema: unknown = {}) => ({
  description,
  content: {
    'application/json': {
      schema: { allOf: [{ $ref: '#/components/schemas/OkEnvelope' }, { properties: { data: dataSchema } }] },
    },
  },
});

function op(
  tag: string,
  summary: string,
  options: { auth?: boolean; success?: string; dataSchema?: unknown; params?: unknown[]; body?: unknown; extraResponses?: Record<string, unknown> } = {}
) {
  const auth = options.auth !== false;
  const parameters: unknown[] = [...(options.params || [])];
  if (auth) {
    parameters.unshift({
      name: 'x-workspace-id',
      in: 'header',
      required: false,
      schema: { type: 'string' },
      description:
        'Optional organization scope. Must be an approved workspace of the caller; ignored if no active membership exists.',
    });
  }

  return {
    tags: [tag],
    summary,
    ...(parameters.length ? { parameters } : {}),
    ...(options.body
      ? {
          requestBody: {
            required: true,
            content: { 'application/json': { schema: options.body } },
          },
        }
      : {}),
    responses: {
      200: jsonOk(options.success || 'Success', options.dataSchema || {}),
      ...(auth ? { 401: commonErrors[401], 403: commonErrors[403] } : { 400: commonErrors[400] }),
      ...(options.extraResponses || {}),
    },
    ...(auth ? { security: [{ bearerAuth: [] }] } : {}),
  };
}

const pathParam = (name: string, description?: string) => ({
  name,
  in: 'path',
  required: true,
  schema: { type: 'string' },
  ...(description ? { description } : {}),
});

const queryParams = (...names: string[]) =>
  names.map((n) => ({ name: n, in: 'query', required: false, schema: { type: 'string' } }));

const paginationParams = [
  { name: 'page', in: 'query', required: false, schema: { type: 'integer', minimum: 1, default: 1 } },
  { name: 'limit', in: 'query', required: false, schema: { type: 'integer', minimum: 1, maximum: 100, default: 20 } },
];

export const openApiSpec = {
  openapi: '3.0.3',
  info: {
    title: 'Swasthya AI Platform API',
    version: '1.0.0',
    description: [
      'Healthcare access and coordination API.',
      '',
      '**Prototype notice.** This is a coordination prototype, not a certified medical device.',
      'Bed counts, doctor availability, diagnostic values and pharmacy stock are synthetic demo data',
      'unless an authorized source is connected. In a medical emergency, contact 112 / 108.',
      '',
      '**Auth model.** Every protected endpoint authorizes server-side on the caller\'s role *and* their',
      'relationship to the object (patient-of-record, active organization membership, or active consent).',
      'A role name alone never grants access to another person\'s record.',
      '',
      '**Envelopes.** Success: `{ success: true, data, meta }`. Error:',
      '`{ success: false, error: { code, message, details? } }`. Every response carries `X-Request-Id`.',
    ].join('\n'),
    license: { name: 'Prototype — internal use' },
  },
  servers: [{ url: '/api/v1', description: 'Current deployment' }],
  tags: [
    { name: 'Identity', description: 'Signup, sessions, recovery and workspace switching' },
    { name: 'Directory', description: 'Location-based healthcare discovery' },
    { name: 'Care', description: 'Appointments, consultations, prescriptions and lab orders' },
    { name: 'Records', description: 'Patient medical records and documents' },
    { name: 'Operations', description: 'Beds, pharmacy inventory, verification, support and audit' },
    { name: 'Wearables', description: 'Consented health metric ingestion and clinician access' },
    { name: 'Platform', description: 'Health, integration status and API description' },
  ],
  components: {
    securitySchemes: {
      bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
    },
    schemas: {
      OkEnvelope: okEnvelope,
      ErrorEnvelope: errorEnvelope,
      WorkspaceSummary: {
        type: 'object',
        properties: {
          membershipId: { type: 'string', nullable: true },
          organizationId: { type: 'string' },
          organizationName: { type: 'string' },
          organizationType: { type: 'string' },
          role: { type: 'string' },
          via: { type: 'string', enum: ['membership', 'ownership'] },
        },
      },
      IntegrationStatus: {
        type: 'object',
        properties: {
          configured: { type: 'boolean' },
          provider: { type: 'string' },
          requires: { type: 'string', description: 'What an operator must supply to make this live' },
          mode: { type: 'string' },
        },
      },
    },
  },
  paths: {
    // ---------------------------------------------------------------- Identity
    '/auth/signup': {
      post: op('Identity', 'Create a patient account', {
        auth: false,
        success: 'Development only: creates a patient and returns a demo verification token. Production is unavailable until email delivery is implemented.',
        dataSchema: { type: 'object', properties: { user: { type: 'object' }, accessToken: { type: 'string' } } },
        body: {
          type: 'object',
          required: ['name', 'email', 'password'],
          properties: {
            name: { type: 'string', minLength: 2 },
            email: { type: 'string', format: 'email' },
            password: { type: 'string', minLength: 12 },
            phone: { type: 'string' },
            preferredLanguage: { type: 'string', enum: ['en', 'hi'], default: 'en' },
          },
        },
        extraResponses: {
          400: commonErrors[400],
          503: { description: 'INTEGRATION_NOT_CONFIGURED — production email verification is not available.' },
        },
      }),
    },
    '/auth/accept-invitation': {
      post: op('Identity', 'Accept an expiring organization invitation and create or verify the account', {
        auth: false,
        success: 'The token is single-use, expires after 48 hours, and fixes the invited email, organization, and role.',
        body: {
          type: 'object',
          required: ['token', 'name', 'password'],
          properties: {
            token: { type: 'string', minLength: 64, maxLength: 64 },
            name: { type: 'string', minLength: 2 },
            password: { type: 'string', minLength: 12 },
            phone: { type: 'string' },
          },
        },
        extraResponses: { 400: commonErrors[400], 409: commonErrors[409] },
      }),
    },
    '/auth/login': {
      post: op('Identity', 'Exchange credentials for tokens', {
        auth: false,
        success: 'Access token (2h) and rotating refresh token (7d) plus the caller\'s workspaces.',
        dataSchema: {
          type: 'object',
          properties: { user: { type: 'object' }, workspaces: { type: 'array', items: { $ref: '#/components/schemas/WorkspaceSummary' } } },
        },
        body: {
          type: 'object',
          required: ['email', 'password'],
          properties: { email: { type: 'string', format: 'email' }, password: { type: 'string' } },
        },
        extraResponses: {
          429: { description: 'RATE_LIMITED — too many failed attempts for this account or IP.' },
        },
      }),
    },
    '/auth/refresh': {
      post: op('Identity', 'Rotate a refresh token', {
        auth: false,
        success: 'A new access/refresh pair. The presented refresh token is revoked.',
        dataSchema: { type: 'object', properties: { accessToken: { type: 'string' }, refreshToken: { type: 'string' } } },
        body: {
          type: 'object',
          required: ['refreshToken'],
          properties: { refreshToken: { type: 'string' } },
        },
        extraResponses: {
          401: { description: 'UNAUTHENTICATED — refresh token expired, revoked or already rotated (reuse detected).' },
        },
      }),
    },
    '/auth/logout': {
      post: op('Identity', 'Revoke the current session', {
        success: 'The presented refresh token (and its session) is revoked.',
        body: { type: 'object', properties: { refreshToken: { type: 'string' }, allDevices: { type: 'boolean' } } },
      }),
    },
    '/auth/forgot-password': {
      post: op('Identity', 'Request a password reset link', {
        auth: false,
        success: 'Always a generic acknowledgement, whether or not the address exists.',
        body: { type: 'object', required: ['email'], properties: { email: { type: 'string', format: 'email' } } },
      }),
    },
    '/auth/reset-password': {
      post: op('Identity', 'Complete a password reset', {
        auth: false,
        success: 'Password replaced; every existing session for that account is revoked.',
        body: {
          type: 'object',
          required: ['token', 'newPassword'],
          properties: { token: { type: 'string' }, newPassword: { type: 'string', minLength: 12 } },
        },
      }),
    },
    '/auth/verify-email': {
      post: op('Identity', 'Confirm an email verification token', {
        auth: false,
        body: { type: 'object', required: ['token'], properties: { token: { type: 'string' } } },
      }),
    },
    '/auth/me': {
      get: op('Identity', 'Current user, profile and workspaces', {
        dataSchema: {
          type: 'object',
          properties: { user: { type: 'object' }, profile: { type: 'object', nullable: true }, workspaces: { type: 'array' } },
        },
      }),
    },
    '/auth/switch-workspace': {
      post: op('Identity', 'Switch the active workspace (legacy path)', {
        body: { type: 'object', properties: { organizationId: { type: 'string', nullable: true } } },
        extraResponses: { 403: commonErrors[403] },
      }),
    },
    '/me': {
      get: op('Identity', 'Current user and profile'),
      patch: op('Identity', 'Update self-service profile fields', {
        success: 'Name, phone and language only. Role and email verification are not self-editable.',
        body: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            phone: { type: 'string' },
            preferredLanguage: { type: 'string', enum: ['en', 'hi'] },
          },
        },
      }),
    },
    '/me/workspaces': {
      get: op('Identity', 'List approved workspaces the caller may switch into', {
        dataSchema: { type: 'object', properties: { workspaces: { type: 'array', items: { $ref: '#/components/schemas/WorkspaceSummary' } } } },
      }),
    },
    '/me/workspaces/{id}/switch': {
      post: op('Identity', 'Switch into an approved workspace', {
        params: [pathParam('id', 'Organization id')],
        success: 'New tokens scoped to the workspace, plus the effective workspace role.',
        extraResponses: { 403: commonErrors[403] },
      }),
    },

    // --------------------------------------------------------------- Directory
    '/healthcare/search': {
      get: op('Directory', 'Search nearby healthcare facilities and providers', {
        auth: false,
        success:
          'Providers within the radius, nearest first, each with source provenance, fetchedAt and freshness. Empty results and upstream failures are distinguished.',
        params: [
          { name: 'lat', in: 'query', schema: { type: 'number', minimum: -90, maximum: 90, default: 24.5362 } },
          { name: 'lng', in: 'query', schema: { type: 'number', minimum: -180, maximum: 180, default: 81.3037 } },
          { name: 'radiusKm', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 100, default: 10 } },
          { name: 'types', in: 'query', schema: { type: 'string' }, description: 'Comma-separated: hospital, clinic, pharmacy, lab, emergency_provider' },
          { name: 'search', in: 'query', schema: { type: 'string' } },
        ],
        extraResponses: {
          503: { description: 'UPSTREAM_UNAVAILABLE — the discovery source failed; no fallback listings are invented.' },
        },
      }),
    },
    '/healthcare/geocode': {
      get: op('Directory', 'Resolve a place name or PIN code to coordinates', {
        auth: false,
        params: [{ name: 'q', in: 'query', schema: { type: 'string' } }],
      }),
    },

    // -------------------------------------------------------------------- Care
    '/doctors': {
      get: op('Care', 'List doctors, optionally filtered', { auth: false, params: queryParams('specialty', 'organizationId', 'search', ...paginationParams.map(() => '')) }),
    },
    '/doctors/{id}': { get: op('Care', 'Doctor detail, including availability derived for today', { auth: false, params: [pathParam('id')] }) },
    '/doctors/{id}/availability': {
      get: op('Care', 'Derived slot grid for one day: published consultation hours minus live bookings', {
        auth: false,
        params: [pathParam('id'), { name: 'date', in: 'query', required: false, schema: { type: 'string', format: 'date' } }],
        success:
          'Slot grid with per-slot status (available | booked | past), the weekday, and whether the weekday is inside the clinician\'s published roster.',
      }),
    },
    '/doctors/profile': { put: op('Care', 'Update own doctor profile', { body: { type: 'object' } }) },
    '/appointments': {
      get: op('Care', 'List appointments visible to the caller', { params: paginationParams }),
      post: op('Care', 'Book an appointment in a provider-managed slot', {
        success: 'Appointment created. Double booking of the same doctor/date/slot returns 409.',
        body: {
          type: 'object',
          required: ['doctorId', 'appointmentDate', 'timeSlot'],
          properties: {
            doctorId: { type: 'string' },
            appointmentDate: { type: 'string', format: 'date' },
            timeSlot: { type: 'string' },
            reason: { type: 'string' },
            organizationId: { type: 'string' },
          },
        },
        extraResponses: { 409: commonErrors[409] },
      }),
    },
    '/appointments/{id}/status': {
      patch: op('Care', 'Transition appointment status with history tracking', {
        params: [pathParam('id')],
        body: {
          type: 'object',
          required: ['status'],
          properties: {
            status: { type: 'string', enum: ['requested', 'confirmed', 'checked_in', 'completed', 'cancelled', 'no_show'] },
            notes: { type: 'string' },
          },
        },
      }),
    },

    // ----------------------------------------------------------------- Records
    '/records': {
      get: op('Records', 'List medical records the caller is authorized to read'),
      post: op('Records', 'Create a clinical record entry', { body: { type: 'object' } }),
    },
    '/records/ai-draft': {
      post: op('Records', 'Generate a development-only consultation template for a clinician', {
        success: 'Mock mode only. No live AI provider is implemented; the template must be reviewed and replaced before use.',
        body: { type: 'object' },
        extraResponses: { 403: commonErrors[403], 503: { description: 'INTEGRATION_NOT_CONFIGURED — no live AI provider adapter.' } },
      }),
    },
    '/prescriptions': {
      get: op('Records', 'List prescriptions visible to the caller'),
      post: op('Records', 'Write a prescription (clinician roles only)', {
        body: { type: 'object' },
        extraResponses: { 403: commonErrors[403] },
      }),
    },
    '/prescriptions/{id}/dispense': {
      patch: op('Records', 'Record dispensing by a pharmacist', { params: [pathParam('id')] }),
    },
    '/ai/triage': {
      post: op('Records', 'Symptom safety triage with red-flag interception', {
        auth: false,
        success: 'Development-only deterministic demo, marked isMock. Production returns unavailable until a live AI provider is implemented.',
        body: { type: 'object', properties: { symptoms: { type: 'string' }, language: { type: 'string', enum: ['en', 'hi'] } } },
      }),
    },
    '/ai/explain-report': {
      post: op('Records', 'Show a development-only template for supplied lab values', {
        success: 'Requires authentication. Demo does not classify values without supplied reference ranges; production returns unavailable.',
        body: { type: 'object' },
      }),
    },

    // -------------------------------------------------------------- Operations
    '/beds': {
      get: op('Operations', 'Bed board, including freshness flags', { auth: false }),
      post: op('Operations', 'Create a bed category', {
        success: 'Requires an authorized bed manager. Counts are never generated, only recorded from a source.',
        extraResponses: { 403: commonErrors[403] },
      }),
    },
    '/beds/summary': { get: op('Operations', 'Aggregate bed summary with stale-data indicator', { auth: false }) },
    '/beds/{id}': {
      put: op('Operations', 'Record a bed status update', {
        params: [pathParam('id')],
        success: 'Rejects impossible capacity states and records the updating user and timestamp.',
        extraResponses: { 400: commonErrors[400], 403: commonErrors[403] },
      }),
    },
    '/inventory': {
      get: op('Operations', 'Pharmacy inventory with expiry and low-stock flags'),
      post: op('Operations', 'Add an inventory batch', { body: { type: 'object' } }),
    },
    '/inventory/{id}': { put: op('Operations', 'Update stock for a batch', { params: [pathParam('id')] }) },
    '/lab-orders': {
      get: op('Operations', 'Lab order queue scoped to the caller'),
      post: op('Operations', 'Create a lab order', { body: { type: 'object' } }),
    },
    '/lab-orders/{id}': { get: op('Operations', 'Lab order detail', { params: [pathParam('id')] }) },
    '/lab-orders/{id}/status': { patch: op('Operations', 'Advance the sample lifecycle', { params: [pathParam('id')] }) },
    '/lab-orders/{id}/results': { patch: op('Operations', 'Enter structured results', { params: [pathParam('id')] }) },
    '/lab-orders/{id}/release': {
      patch: op('Operations', 'Authorized release of a report to the patient', {
        params: [pathParam('id')],
        success: 'Before release, patients receive a masked report status notice instead of results.',
        extraResponses: { 403: commonErrors[403] },
      }),
    },
    '/verification/queue': {
      get: op('Operations', 'Credential and facility verification queue', { params: paginationParams }),
    },
    '/verification/{id}/decision': {
      patch: op('Operations', 'Record a verification decision with a reason', {
        params: [pathParam('id')],
        success: 'Submitted forms alone never mark a provider verified; a reviewer decision is required.',
      }),
    },
    '/support': {
      get: op('Operations', 'Support tickets, ticket-scoped access'),
      post: op('Operations', 'Open a support ticket', { body: { type: 'object' } }),
    },
    '/support/{id}/reply': { post: op('Operations', 'Reply to a ticket', { params: [pathParam('id')] }) },
    '/audit-logs': {
      get: op('Operations', 'Append-only audit trail (restricted roles)', { params: paginationParams, extraResponses: { 403: commonErrors[403] } }),
    },
    '/analytics/public-health': {
      get: op('Operations', 'De-identified public-health aggregates', { params: queryParams('region', 'from', 'to') }),
    },
    '/organizations': {
      get: op('Operations', 'List organizations', { auth: false, params: queryParams('type', 'city', 'search') }),
      post: op('Operations', 'Submit an organization for verification', {
        success: 'Organization and owner membership remain pending until verification is approved.',
        body: { type: 'object' },
      }),
    },
    '/organizations/{id}': { get: op('Operations', 'Organization detail', { auth: false, params: [pathParam('id')] }) },
    '/organizations/{organizationId}/invite': {
      post: op('Operations', 'Invite staff into an organization', {
        params: [pathParam('organizationId')],
        success: 'Creates a 48-hour single-use invitation. The raw token is returned only in development; production invitations are blocked until email delivery is implemented.',
        extraResponses: { 403: commonErrors[403], 503: { description: 'INTEGRATION_NOT_CONFIGURED — production email delivery is unavailable.' } },
      }),
    },
    '/organizations/{organizationId}/members': {
      get: op('Operations', 'List organization members', { params: [pathParam('organizationId'), ...paginationParams] }),
    },

    // --------------------------------------------------------------- Wearables
    '/wearables/status': {
      get: op('Wearables', 'Connection and consent status for the caller', {
        success: 'Reports which providers are genuinely available. Unconfigured platforms are returned as not configured, never as connected.',
      }),
    },
    '/wearables/ble-ingest': {
      post: op('Wearables', 'Ingest samples from a paired Bluetooth device', {
        success: 'Normalizes units, deduplicates samples and stores source/measuredAt/receivedAt.',
        body: { type: 'object' },
      }),
    },
    '/wearables/sync': {
      post: op('Wearables', 'Run a sync job for a connection', {
        success: 'Returns job status; failures are surfaced rather than silently succeeding.',
        extraResponses: { 503: { description: 'UPSTREAM_UNAVAILABLE — vendor API unreachable.' } },
      }),
    },
    '/wearables/companion-token': { post: op('Wearables', 'Issue a scoped token for a native companion app', { body: { type: 'object' } }) },
    '/wearables/disconnect': { post: op('Wearables', 'Disconnect a provider and revoke its access', { body: { type: 'object' } }) },
    '/wearables/fitbit/authorize': {
      get: op('Wearables', 'Begin vendor OAuth', {
        success: 'Redirects to the vendor. Returns 503 INTEGRATION_NOT_CONFIGURED when no OAuth client is configured.',
        extraResponses: { 503: { description: 'INTEGRATION_NOT_CONFIGURED — no vendor OAuth credentials present.' } },
      }),
    },
    '/wearables/metrics': { get: op('Wearables', 'Read consented metric samples', { params: queryParams('from', 'to', 'metric', 'connectionId') }) },
    '/wearables/summary': { get: op('Wearables', 'Daily aggregated summary with last-sync and staleness', { params: queryParams('from', 'to') }) },
    '/consent/my-consents': { get: op('Wearables', 'List the caller\'s consent grants') },
    '/consent/grant': { post: op('Wearables', 'Grant a clinician granular, expiring access', { body: { type: 'object' } }) },
    '/consent/revoke': { post: op('Wearables', 'Revoke a consent grant immediately', { body: { type: 'object' } }) },
    '/consent/available-doctors': { get: op('Wearables', 'List clinicians eligible for a consent grant') },
    '/clinician/patients': {
      get: op('Wearables', 'Patients with an active consent and clinician relationship', {
        success: 'Empty for a clinician with no consents — access is never implied by role alone.',
      }),
    },
    '/clinician/patients/{patientId}/metrics': {
      get: op('Wearables', 'Consented metric view for one patient', {
        params: [pathParam('patientId')],
        extraResponses: { 403: commonErrors[403], 404: commonErrors[404] },
      }),
    },

    // ---------------------------------------------------------------- Platform
    '/integrations': {
      get: op('Platform', 'Which optional integrations are actually configured', {
        dataSchema: { type: 'object', properties: { integrations: { type: 'object' } } },
      }),
    },
  },
};

/** Minimal dependency-free browser listing the documented operations. */
export function renderDocsHtml(): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Swasthya AI — API Reference</title>
<style>
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  body { margin:0; font:15px/1.55 Inter, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; background:#f8fafc; color:#0f172a; }
  header { background:#042f2e; color:#ecfeff; padding:28px 24px; }
  header h1 { margin:0 0 6px; font-size:22px; letter-spacing:-.01em; }
  header p { margin:0; max-width:70ch; color:#99f6e4; font-size:13.5px; }
  main { max-width:1080px; margin:0 auto; padding:24px; }
  .toolbar { display:flex; gap:12px; flex-wrap:wrap; margin-bottom:20px; }
  input, select { padding:9px 12px; border:1px solid #cbd5e1; border-radius:9px; font:inherit; background:#fff; }
  input { flex:1; min-width:240px; }
  section { margin-bottom:26px; }
  h2 { font-size:15px; text-transform:uppercase; letter-spacing:.07em; color:#0f766e; margin:0 0 10px; }
  .op { background:#fff; border:1px solid #e2e8f0; border-radius:12px; margin-bottom:9px; overflow:hidden; }
  .op > summary { cursor:pointer; padding:12px 14px; display:flex; align-items:center; gap:12px; }
  .op[open] > summary { border-bottom:1px solid #e2e8f0; }
  .m { font:600 11px/1 ui-monospace, SFMono-Regular, Menlo, monospace; padding:6px 9px; border-radius:6px; letter-spacing:.04em; }
  .get { background:#ecfdf5; color:#047857; }
  .post { background:#eff6ff; color:#1d4ed8; }
  .put, .patch { background:#fffbeb; color:#b45309; }
  .delete { background:#fff1f2; color:#be123c; }
  .path { font-family:ui-monospace, SFMono-Regular, Menlo, monospace; font-weight:600; font-size:13.5px; }
  .lock { font-size:11px; color:#64748b; border:1px solid #e2e8f0; border-radius:999px; padding:2px 9px; }
  .lock.open { color:#047857; border-color:#a7f3d0; background:#ecfdf5; }
  .body { padding:12px 14px; font-size:13.5px; }
  .body p { margin:0 0 8px; }
  pre { background:#0f172a; color:#e2e8f0; padding:12px; border-radius:9px; overflow:auto; font-size:12px; max-height:340px; }
  .empty { color:#64748b; font-style:italic; }
  footer { max-width:1080px; margin:0 auto; padding:0 24px 40px; color:#64748b; font-size:12.5px; }
</style>
</head>
<body>
<header>
  <h1>Swasthya AI Platform API</h1>
  <p>Healthcare access and coordination prototype. Bed counts, slots, diagnostic values and stock are synthetic demo data unless an authorized source is connected. In an emergency call 112 / 108.</p>
</header>
<main>
  <div class="toolbar">
    <input id="q" placeholder="Filter by path or summary…" />
    <select id="t"><option value="">All tags</option></select>
  </div>
  <div id="out"></div>
  <p><a href="/api/v1/openapi.json">Raw OpenAPI 3.0 document</a></p>
</main>
<footer>Authenticated operations require <code>Authorization: Bearer &lt;accessToken&gt;</code>. Every response includes <code>X-Request-Id</code>.</footer>
<script>
(async () => {
  const spec = await (await fetch('/api/v1/openapi.json')).json();
  const tags = [...new Set(Object.values(spec.paths).flatMap(p => Object.values(p).flatMap(o => o.tags || [])))];
  const sel = document.getElementById('t');
  tags.forEach(t => { const o = document.createElement('option'); o.value = t; o.textContent = t; sel.appendChild(o); });

  function render() {
    const q = document.getElementById('q').value.toLowerCase();
    const tag = sel.value;
    const out = document.getElementById('out');
    out.innerHTML = '';
    let shown = 0;
    tags.filter(t => !tag || t === tag).forEach(t => {
      const ops = [];
      for (const [path, methods] of Object.entries(spec.paths)) {
        for (const [method, o] of Object.entries(methods)) {
          if (!(o.tags || []).includes(t)) continue;
          const hay = (method + ' ' + path + ' ' + (o.summary || '')).toLowerCase();
          if (q && !hay.includes(q)) continue;
          ops.push({ path, method, o });
        }
      }
      if (!ops.length) return;
      shown += ops.length;
      const sec = document.createElement('section');
      const h = document.createElement('h2');
      h.textContent = t;
      sec.appendChild(h);
      ops.forEach(({ path, method, o }) => {
        const d = document.createElement('details');
        d.className = 'op';
        const auth = !!o.security;
        const codes = Object.keys(o.responses || {}).join(' · ');
        d.innerHTML = '<summary><span class="m ' + method + '">' + method.toUpperCase() + '</span>'
          + '<span class="path">' + path + '</span>'
          + '<span class="lock ' + (auth ? '' : 'open') + '">' + (auth ? 'auth required' : 'public') + '</span></summary>'
          + '<div class="body"><p>' + (o.summary || '') + '</p>'
          + '<p>Responses: <code>' + codes + '</code></p>'
          + (o.requestBody ? '<p>Request body:</p><pre>' + JSON.stringify(o.requestBody.content['application/json'].schema, null, 2) + '</pre>' : '')
          + '</div>';
        sec.appendChild(d);
      });
      out.appendChild(sec);
    });
    if (!shown) out.innerHTML = '<p class="empty">No operations match that filter.</p>';
  }

  document.getElementById('q').addEventListener('input', render);
  sel.addEventListener('change', render);
  render();
})();
</script>
</body>
</html>`;
}
