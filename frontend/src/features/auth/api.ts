import { apiFetch } from '../../lib/api-client';
import {
  GateStaffAssignment,
  LoginInput,
  LoginResponse,
  RefreshResponse,
  RegisterInput,
  RegisteredUser,
  RoleWithPermissions,
  UserRoleAssignment,
  UserProfile,
} from './types';

export function login(input: LoginInput) {
  return apiFetch<LoginResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function register(input: RegisterInput) {
  return apiFetch<RegisteredUser>('/auth/register', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function refresh(refreshToken: string) {
  return apiFetch<RefreshResponse>('/auth/refresh', {
    method: 'POST',
    body: JSON.stringify({ refresh_token: refreshToken }),
  });
}

export function logout(refreshToken: string) {
  return apiFetch<void>('/auth/logout', {
    method: 'POST',
    body: JSON.stringify({ refresh_token: refreshToken }),
  });
}

export function getMe() {
  return apiFetch<UserProfile>('/auth/me');
}

export function getRoles() {
  return apiFetch<RoleWithPermissions[]>('/roles');
}

export function getUserRoles(userId: string) {
  return apiFetch<UserRoleAssignment[]>(`/admin/users/${userId}/roles`);
}

export function assignUserRole(userId: string, roleCode: string) {
  return apiFetch<UserRoleAssignment[]>(`/admin/users/${userId}/roles`, {
    method: 'POST',
    body: JSON.stringify({ role_code: roleCode }),
  });
}

export function removeUserRole(userId: string, roleCode: string) {
  return apiFetch<void>(`/admin/users/${userId}/roles/${roleCode}`, {
    method: 'DELETE',
  });
}

export function createGateStaffAssignment(concertId: string, userId: string, gateLabel: string) {
  return apiFetch<GateStaffAssignment>(`/admin/concerts/${concertId}/gate-staff`, {
    method: 'POST',
    body: JSON.stringify({ user_id: userId, gate_label: gateLabel }),
  });
}

export function getGateStaffAssignments(concertId: string) {
  return apiFetch<GateStaffAssignment[]>(`/admin/concerts/${concertId}/gate-staff`);
}

export function deleteGateStaffAssignment(concertId: string, assignmentId: string) {
  return apiFetch<void>(`/admin/concerts/${concertId}/gate-staff/${assignmentId}`, {
    method: 'DELETE',
  });
}
