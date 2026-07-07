const ORGANIZER_ROLE = 'ORGANIZER';
const AUTH_CHANGED_EVENT = 'ticketbox-auth-changed';
type JwtPayload = { exp?: number };

export function isAuthenticated(): boolean {
  const token = localStorage.getItem('accessToken');
  if (!token) return false;
  const expiresAt = getTokenExpiration(token);
  return expiresAt === null || expiresAt > Date.now() || Boolean(localStorage.getItem('refreshToken'));
}

export function getTokenExpiration(token: string): number | null {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  try {
    const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/'))) as JwtPayload;
    return typeof payload.exp === 'number' ? payload.exp * 1000 : null;
  } catch {
    return 0;
  }
}

export function clearSession(): void {
  localStorage.removeItem('accessToken');
  localStorage.removeItem('refreshToken');
  localStorage.removeItem('userRoles');
  window.dispatchEvent(new Event(AUTH_CHANGED_EVENT));
}

export function notifyAuthChanged(): void {
  window.dispatchEvent(new Event(AUTH_CHANGED_EVENT));
}

export function getPostLoginRedirect(roles: string[]): string {
  return roles.includes(ORGANIZER_ROLE) ? '/organizer/concerts' : '/concerts';
}

export function getStoredRoles(): string[] {
  const raw = localStorage.getItem('userRoles');

  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((role): role is string => typeof role === 'string') : [];
  } catch {
    return [];
  }
}

export function userHasRole(role: string): boolean {
  return getStoredRoles().includes(role);
}
