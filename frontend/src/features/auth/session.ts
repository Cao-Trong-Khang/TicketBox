import { RoleCode, UserProfile } from './types';

const ACCESS_TOKEN_KEY = 'accessToken';
const REFRESH_TOKEN_KEY = 'refreshToken';
const USER_PROFILE_KEY = 'ticketboxUser';

export type StoredSession = {
  accessToken: string;
  refreshToken: string;
  user: UserProfile;
};

export function saveSession(session: StoredSession) {
  localStorage.setItem(ACCESS_TOKEN_KEY, session.accessToken);
  localStorage.setItem(REFRESH_TOKEN_KEY, session.refreshToken);
  localStorage.setItem(USER_PROFILE_KEY, JSON.stringify(session.user));
  emitAuthChanged();
}

export function clearSession() {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  localStorage.removeItem(USER_PROFILE_KEY);
  emitAuthChanged();
}

export function getAccessToken() {
  return localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function getRefreshToken() {
  return localStorage.getItem(REFRESH_TOKEN_KEY);
}

export function getStoredUser(): UserProfile | null {
  const value = localStorage.getItem(USER_PROFILE_KEY);

  if (!value) {
    return null;
  }

  try {
    return JSON.parse(value) as UserProfile;
  } catch {
    return null;
  }
}

export function hasRole(role: RoleCode) {
  return getStoredUser()?.roles.includes(role) ?? false;
}

export function getPostLoginPath(roles: RoleCode[]) {
  if (roles.includes('ORGANIZER')) {
    return '/admin/dashboard';
  }

  if (roles.includes('GATE_STAFF')) {
    return '/checkin';
  }

  return '/concerts';
}

export function emitAuthChanged() {
  window.dispatchEvent(new Event('ticketbox-auth-changed'));
}
