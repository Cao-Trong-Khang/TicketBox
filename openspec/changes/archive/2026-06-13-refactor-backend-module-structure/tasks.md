## 1. Backend Module Layout

- [x] 1.1 Move `backend/src/auth` to `backend/src/modules/auth`.
- [x] 1.2 Move `backend/src/rbac` to `backend/src/modules/rbac`.
- [x] 1.3 Move `backend/src/health` to `backend/src/modules/health`.
- [x] 1.4 Move `backend/src/shared/prisma` to `backend/src/prisma`.
- [x] 1.5 Move `backend/src/shared/config` to `backend/src/config`.
- [x] 1.6 Remove or repurpose `backend/src/shared` so it does not remain an unclear catch-all.

## 2. Imports and Module Boundaries

- [x] 2.1 Update `AppModule` imports to use `src/modules/*`, `src/config`, and `src/prisma`.
- [x] 2.2 Update auth imports for Prisma, config, RBAC constants, and local DTO/types/guards/strategy paths.
- [x] 2.3 Update RBAC imports for Prisma, authenticated user typing, decorators, guards, and constants.
- [x] 2.4 Update health imports for config paths.
- [x] 2.5 Keep `JwtAuthGuard` inside `modules/auth`.
- [x] 2.6 Keep `PermissionsGuard`, `@Permissions()`, `PermissionService`, and RBAC constants inside `modules/rbac`.
- [x] 2.7 Avoid adding new behavior during import cleanup.

## 3. Behavior Preservation Checks

- [x] 3.1 Verify `POST /auth/register` still hashes passwords and assigns `AUDIENCE` through `user_roles`.
- [x] 3.2 Verify `POST /auth/login` still returns `{ accessToken }`.
- [x] 3.3 Verify JWT payload still contains only `sub` and `email`.
- [x] 3.4 Verify `GET /auth/me` still returns `req.user.id` and `req.user.email` with a valid token.
- [x] 3.5 Verify permission-protected routes still return `401` without a token.
- [x] 3.6 Verify permission-protected routes still return `403` when the user lacks a required permission.
- [x] 3.7 Verify permission-protected routes still return `200` when the user has a required permission.

## 4. Verification

- [x] 4.1 Run backend build.
- [x] 4.2 Run backend tests.
- [x] 4.3 Run backend lint if configured.
- [x] 4.4 Confirm Prisma schema, migrations, and seed data were not changed by this refactor.
- [x] 4.5 Confirm OpenSpec status reports all refactor tasks complete after implementation.
