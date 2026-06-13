## Why

The backend currently works, but its source layout mixes feature modules (`auth`, `rbac`, `health`) directly under `src` while `src/modules/README.md` says future domain modules should live under `src/modules`. As TicketBox grows into concerts, checkout, payments, tickets, notifications, and check-in, this inconsistency will make module ownership and import boundaries harder to reason about.

This change refactors the backend folder structure only. It must not change authentication, RBAC, Prisma schema, migrations, seed data, API routes, HTTP responses, JWT payloads, or permission behavior.

## What Changes

- Move feature modules into `backend/src/modules`.
- Move Prisma infrastructure from `backend/src/shared/prisma` to `backend/src/prisma`.
- Move configuration infrastructure from `backend/src/shared/config` to `backend/src/config`.
- Keep RBAC-owned concepts inside `modules/rbac`:
  - `permissions.decorator.ts`
  - `permissions.guard.ts`
  - `rbac.constants.ts`
  - `permission.service.ts`
- Keep auth-owned concepts inside `modules/auth`:
  - `jwt-auth.guard.ts`
  - `jwt.strategy.ts`
  - auth DTOs, types, service, controller, module, tests
- Remove or repurpose `backend/src/shared` so it does not become an unclear catch-all.
- Update all imports and tests after moving files.

## Capabilities

- New: none.
- Modified:
  - `project-foundation`: backend source layout becomes a clearer modular-monolith structure.

## Behavior Preservation

The refactor MUST preserve existing behavior:

- `POST /auth/register` still registers a user, hashes password with bcrypt, and assigns the default `AUDIENCE` role through `user_roles`.
- `POST /auth/login` still returns `{ accessToken }`.
- JWT payload still contains only `sub` and `email`.
- `GET /auth/me` still reads `req.user.id` and `req.user.email` from `JwtAuthGuard`.
- `PermissionsGuard` still reads required permissions from `@Permissions()` and checks permissions through PostgreSQL using `req.user.id`.
- Missing token still returns `401 Unauthorized`.
- Missing permission still returns `403 Forbidden`.
- User with the required permission still receives success.

## Impact

- Affected code:
  - `backend/src/app.module.ts`
  - `backend/src/auth/**`
  - `backend/src/rbac/**`
  - `backend/src/health/**`
  - `backend/src/shared/config/**`
  - `backend/src/shared/prisma/**`
  - backend tests that import moved modules
- External systems:
  - No new external service is introduced.
  - No database schema or migration change is introduced.
  - No Docker service change is introduced.
- Non-goals:
  - No new auth endpoint.
  - No new role, permission, guard behavior, or seed behavior.
  - No Prisma schema change.
  - No frontend change.
