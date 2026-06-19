import { API_BASE_URL } from './config';
import { clearSession, getAccessToken } from '../features/auth/session';

export type ApiError = {
  status: number;
  message: string;
  data?: unknown;
};

export async function apiFetch<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = getAccessToken();
  const headers = new Headers(options.headers);

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  if (!headers.has('Content-Type') && !(options.body instanceof URLSearchParams) && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  const text = await response.text();
  const data = text ? parseJson(text) : {};

  if (!response.ok) {
    if (response.status === 401) {
      clearSession();
    }

    throw {
      status: response.status,
      message: getErrorMessage(data, response.statusText),
      data,
    } satisfies ApiError;
  }

  return data as T;
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
