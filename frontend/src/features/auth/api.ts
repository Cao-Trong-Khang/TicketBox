import { apiFetch } from '../../lib/api-client';
import { LoginInput, LoginResponse, RegisterInput, RegisteredUser } from './types';

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
