const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

/** Carries the backend's machine-readable error code and message to the UI. */
export class ApiRequestError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiRequestError';
  }
}

interface RequestOptions {
  method?: string;
  token?: string;
  body?: unknown;
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    method: options.method ?? 'GET',
    headers: {
      ...(options.body !== undefined && { 'Content-Type': 'application/json' }),
      ...(options.token && { Authorization: `Bearer ${options.token}` }),
    },
    ...(options.body !== undefined && { body: JSON.stringify(options.body) }),
  });

  if (response.status === 204) {
    return undefined as T;
  }

  // An authenticated request that comes back 401 means the stored session is
  // dead (e.g. the user was deleted). Clear it and return to the login picker
  // instead of leaving the app stuck behind a permanent error banner.
  if (response.status === 401 && options.token && typeof window !== 'undefined') {
    window.localStorage.removeItem('meeting-room-session');
    window.location.assign('/');
  }

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const error = payload?.error;
    throw new ApiRequestError(
      response.status,
      error?.code ?? 'UNKNOWN_ERROR',
      error?.message ?? `Request failed with status ${response.status}`,
      error?.details,
    );
  }
  return payload as T;
}
