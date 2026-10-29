const API_BASE = '/api/v1';

export const TOKEN_KEY = 'swasthya_token';
export const REFRESH_TOKEN_KEY = 'swasthya_refresh_token';
export const WORKSPACE_KEY = 'swasthya_workspace_id';

/** Broadcast so AuthContext can clear state when a session cannot be recovered. */
export const SESSION_EXPIRED_EVENT = 'swasthya:session-expired';

export class ApiError extends Error {
  status: number;
  code: string;
  requestId?: string;
  details?: unknown;
  data: any;

  constructor(
    message: string,
    status: number,
    options: { code?: string; requestId?: string; details?: unknown; data?: any } = {}
  ) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = options.code || 'UNKNOWN';
    this.requestId = options.requestId;
    this.details = options.details;
    this.data = options.data;
  }

  /** True when the request failed because the caller is not (or no longer) authorized. */
  get isAuthError(): boolean {
    return this.status === 401;
  }

  get isNotConfigured(): boolean {
    return this.code === 'INTEGRATION_NOT_CONFIGURED';
  }
}

/**
 * Normalises every error shape the API has ever emitted into one string.
 * The current envelope is `{ error: { code, message } }`, but older routes and
 * cached responses still return `{ error: '...' }` or a bare `{ message }`.
 */
function extractMessage(payload: any, status: number): string {
  if (!payload) return `Request failed with status ${status}`;
  const err = payload.error;
  if (typeof err === 'string' && err.trim()) return err;
  if (err && typeof err === 'object' && typeof err.message === 'string') return err.message;
  if (typeof payload.message === 'string' && payload.message.trim()) return payload.message;
  return `Request failed with status ${status}`;
}

function extractCode(payload: any): string {
  const err = payload?.error;
  if (err && typeof err === 'object' && typeof err.code === 'string') return err.code;
  if (typeof payload?.errorCode === 'string') return payload.errorCode;
  return 'UNKNOWN';
}

function extractDetails(payload: any): unknown {
  const err = payload?.error;
  if (err && typeof err === 'object') return err.details;
  return payload?.details;
}

// Single-flight refresh: concurrent 401s share one refresh round-trip.
let refreshInFlight: Promise<boolean> | null = null;

async function refreshAccessToken(): Promise<boolean> {
  const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
  if (!refreshToken) return false;

  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      try {
        const res = await fetch(`${API_BASE}/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken }),
        });
        const body = await res.json().catch(() => null);
        // `/auth/refresh` uses the standard envelope; older endpoints are flat.
        const payload = body?.data ?? body;
        if (!res.ok || !body?.success || !payload?.accessToken) return false;

        localStorage.setItem(TOKEN_KEY, payload.accessToken);
        if (payload.refreshToken) localStorage.setItem(REFRESH_TOKEN_KEY, payload.refreshToken);
        return true;
      } catch {
        return false;
      } finally {
        // Release the lock on the next tick so awaiting callers all observe the result.
        setTimeout(() => {
          refreshInFlight = null;
        }, 0);
      }
    })();
  }

  return refreshInFlight;
}

function clearSession(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  localStorage.removeItem(WORKSPACE_KEY);
  window.dispatchEvent(new CustomEvent(SESSION_EXPIRED_EVENT));
}

export interface RequestOptions extends RequestInit {
  /** Set false for endpoints that must not trigger a refresh/retry cycle. */
  auth?: boolean;
  /**
   * Opt in to receiving only the envelope's `data` payload. Defaults to false,
   * which returns the whole body so existing call sites that read
   * `res.success` / `res.user` / `res.data` keep working unchanged.
   */
  unwrap?: boolean;
}

async function rawRequest(endpoint: string, options: RequestOptions = {}): Promise<Response> {
  const { auth = true, unwrap: _unwrap, ...init } = options;
  const token = localStorage.getItem(TOKEN_KEY);
  const activeWorkspaceId = localStorage.getItem(WORKSPACE_KEY);

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(init.headers as Record<string, string>),
  };
  if (auth && token) headers['Authorization'] = `Bearer ${token}`;
  if (activeWorkspaceId) headers['x-workspace-id'] = activeWorkspaceId;

  return fetch(`${API_BASE}${endpoint}`, { ...init, headers });
}

/**
 * Core request helper.
 *
 * Returns the full response body by default (backward compatible with every
 * existing call site). Pass `unwrap: true` to receive just `body.data` for the
 * standard `{ success, data, meta }` endpoints.
 */
export async function request<T = any>(endpoint: string, options: RequestOptions = {}): Promise<T> {
  const { unwrap = false, auth = true, ...init } = options;

  let response = await rawRequest(endpoint, { ...init, auth });

  // One transparent refresh + retry when an access token has expired.
  if (response.status === 401 && auth) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      response = await rawRequest(endpoint, { ...init, auth });
    } else {
      clearSession();
      const body = await response.json().catch(() => null);
      throw new ApiError(extractMessage(body, 401), 401, {
        code: extractCode(body) === 'UNKNOWN' ? 'UNAUTHENTICATED' : extractCode(body),
        requestId: body?.requestId,
        details: extractDetails(body),
        data: body,
      });
    }
  }

  const body = await response.json().catch(() => null);

  if (!response.ok) {
    const requestId =
      body?.requestId || response.headers.get('X-Request-Id') || undefined;
    throw new ApiError(extractMessage(body, response.status), response.status, {
      code: extractCode(body),
      requestId,
      details: extractDetails(body),
      data: body,
    });
  }

  if (!unwrap) return body as T;
  return (body && typeof body === 'object' && 'data' in body ? body.data : body) as T;
}

export const api = {
  get: <T = any>(endpoint: string, options?: RequestOptions) =>
    request<T>(endpoint, { ...options, method: 'GET' }),
  post: <T = any>(endpoint: string, body?: any, options?: RequestOptions) =>
    request<T>(endpoint, { ...options, method: 'POST', body: body ? JSON.stringify(body) : undefined }),
  put: <T = any>(endpoint: string, body?: any, options?: RequestOptions) =>
    request<T>(endpoint, { ...options, method: 'PUT', body: body ? JSON.stringify(body) : undefined }),
  patch: <T = any>(endpoint: string, body?: any, options?: RequestOptions) =>
    request<T>(endpoint, { ...options, method: 'PATCH', body: body ? JSON.stringify(body) : undefined }),
  delete: <T = any>(endpoint: string, options?: RequestOptions) =>
    request<T>(endpoint, { ...options, method: 'DELETE' }),

  /** Escape hatch for endpoints that return fields outside the `data` envelope. */
  requestRaw: rawRequest,
};
