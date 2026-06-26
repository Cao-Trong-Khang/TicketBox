const ORGANIZER_ROLE = 'ORGANIZER';

export function isAuthenticated(): boolean {
  return Boolean(localStorage.getItem('accessToken'));
}

export function getPostLoginRedirect(roles: string[]): string {
  return roles.includes(ORGANIZER_ROLE) ? '/admin/dashboard' : '/concerts';
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