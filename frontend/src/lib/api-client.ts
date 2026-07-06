import { API_BASE_URL } from './config';
import { clearSession, getTokenExpiration, notifyAuthChanged } from '../features/auth/session';

export type ApiError = {
  status: number;
  message: string;
  data?: unknown;
};

type RefreshResponse = { accessToken: string; refreshToken: string };
let refreshPromise: Promise<string> | null = null;

export async function apiFetch<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  let token = localStorage.getItem('accessToken');
  const expiresAt = token ? getTokenExpiration(token) : null;
  if (shouldRefresh(endpoint) && token && expiresAt !== null && expiresAt <= Date.now()) {
    token = await refreshAccessToken();
  }

  let response = await sendRequest(endpoint, options, token);
  if (response.status === 401 && shouldRefresh(endpoint)) {
    token = await refreshAccessToken();
    response = await sendRequest(endpoint, options, token);
    if (response.status === 401) return failRefresh();
  }

  const text = await response.text();
  const data = text ? parseJson(text) : {};

  if (!response.ok) {
    throw { status: response.status, message: getErrorMessage(data, response.statusText), data } satisfies ApiError;
  }

  return data as T;
}

function shouldRefresh(endpoint: string): boolean {
  return !['/auth/login', '/auth/register', '/auth/refresh'].includes(endpoint);
}

async function sendRequest(endpoint: string, options: RequestInit, token: string | null): Promise<Response> {
  const headers = new Headers(options.headers);

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  if (!headers.has('Content-Type') && !(options.body instanceof URLSearchParams) && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  return fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });
}

async function refreshAccessToken(): Promise<string> {
  if (refreshPromise) return refreshPromise;
  refreshPromise = performRefresh().finally(() => { refreshPromise = null; });
  return refreshPromise;
}

async function performRefresh(): Promise<string> {
  const refreshToken = localStorage.getItem('refreshToken');
  if (!refreshToken) return failRefresh();

  try {
    const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });
    if (!response.ok) return failRefresh();

    const data = (await response.json()) as Partial<RefreshResponse>;
    if (!data.accessToken || !data.refreshToken) return failRefresh();

    localStorage.setItem('accessToken', data.accessToken);
    localStorage.setItem('refreshToken', data.refreshToken);
    notifyAuthChanged();
    return data.accessToken;
  } catch {
    return failRefresh();
  }
}

function failRefresh(): never {
  clearSession();
  if (window.location.pathname !== '/login') window.location.assign('/login');
  throw { status: 401, message: 'Session expired. Please sign in again.' } satisfies ApiError;
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return {};
  }
}

function getErrorMessage(data: unknown, fallback: string) {
  if (typeof data === 'object' && data !== null && 'message' in data) {
    const message = (data as { message?: unknown }).message;
    if (Array.isArray(message)) {
      return message.join(', ');
    }
    if (typeof message === 'string') {
      return message;
    }
  }

  return fallback || 'Có lỗi xảy ra.';
}
