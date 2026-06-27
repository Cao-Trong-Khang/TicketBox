## 1. Backend Auth Profile

- [x] 1.1 Update the existing `/auth/me` response to include `roles` as a string array.
- [x] 1.2 Keep `/auth/me` protected by the existing `JwtAuthGuard`.
- [x] 1.3 Query the authenticated user's roles from the existing user-role schema.
- [x] 1.4 Return role codes, for example `ORGANIZER`, not internal role ids.
- [x] 1.5 Preferred response shape:

  ```ts
  {
    id: string;
    email: string;
    roles: string[];
  }
  ```

- [x] 1.6 Keep the `POST /auth/login` response unchanged.
- [x] 1.7 Do not add roles to the JWT payload in this task.

## 2. Frontend Auth API and Types

- [x] 2.1 Add a frontend auth profile API helper using the existing `apiFetch` pattern.
- [x] 2.2 Add or update TypeScript types for the `/auth/me` response with `roles: string[]`.
- [x] 2.3 Do not hard-code backend URL.
- [x] 2.4 Use role code string `ORGANIZER` for frontend redirect decision.

## 3. Login Redirect Flow

- [x] 3.1 After successful login, store the token as before.
- [x] 3.2 Call `/auth/me` after login using the stored token.
- [x] 3.3 If returned `roles` includes `ORGANIZER`, redirect to `/organizer/concerts`.
- [x] 3.4 Otherwise redirect to `/concerts`.
- [x] 3.5 If `/auth/me` fails after successful login, keep token storage behavior unchanged and fall back to `/concerts`.
- [x] 3.6 Preserve existing invalid-login error behavior.
- [x] 3.7 Do not implement global route guards in this task.
- [x] 3.8 Do not implement role-based AppShell link visibility in this task.

## 4. Verification

- [x] 4.1 Run backend build/lint/test commands if available.
- [x] 4.2 Run frontend build/lint/test commands if available.
- [x] 4.3 Manually verify `/auth/me` returns `roles`.
- [x] 4.4 Manually verify organizer login redirects to `/organizer/concerts`.
- [x] 4.5 Manually verify audience login redirects to `/concerts`.
- [x] 4.6 Manually verify invalid login still shows the existing error state.
- [x] 4.7 Manually verify token storage still works.
