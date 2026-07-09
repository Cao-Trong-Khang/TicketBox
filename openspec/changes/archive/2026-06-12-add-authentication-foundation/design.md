## Context

The current backend is a NestJS modular monolith foundation with health/config endpoints and Docker Compose infrastructure for PostgreSQL, Redis, and Kafka. The blueprint already identifies PostgreSQL as the authoritative store for users and ADR 7 establishes token-based authentication with server-side authorization checks.

This change adds the authentication layer needed before audience, organizer, and check-in staff workflows can protect APIs. It intentionally stops at identity: the backend will know the caller's user ID and email, while RBAC roles and permissions remain a later change.

## Goals / Non-Goals

**Goals:**

- Add a `users` table for identity and login credentials using PostgreSQL as the source of truth.
- Add Prisma as the backend data access layer for the authentication foundation.
- Support registration, login, bcrypt password hashing, JWT access token issuance, and authenticated current-user lookup.
- Add `JwtAuthGuard` and JWT strategy so protected NestJS routes can read `req.user.id` and `req.user.email`.
- Keep JWT payloads minimal with `sub` and `email`.

**Non-Goals:**

- Do not add `users.role` or any role claim to JWT payloads.
- Do not add `roles`, `permissions`, `user_roles`, or `role_permissions`.
- Do not implement `PermissionsGuard`, ownership checks, assignment checks, or role seeding.
- Do not integrate payment providers, email, AI, sponsor CSV, Redis caching, Kafka events, or mobile offline behavior.
- Do not add frontend login UI in this change.

## Decisions

### Use Prisma for PostgreSQL access

Prisma will provide the initial database schema, migration workflow, generated client, and typed access to the `users` table.

Rationale: the backend currently has PostgreSQL configuration but no data access layer. Prisma keeps the first persistent feature small and explicit while aligning with the blueprint's PostgreSQL source-of-truth decision.

Alternative considered: TypeORM. TypeORM fits NestJS patterns, but introduces more entity/repository boilerplate for this small foundation and is not required by the existing codebase.

### Keep `users` focused on identity

The `users` table will include `id`, `email`, `password_hash`, `display_name`, `status`, `created_at`, and `updated_at`.

Rationale: authentication needs account identity and credential verification only. Roles belong to future RBAC join tables, not to `users`, to avoid conflicting sources of truth.

Alternative considered: adding a `role` column for convenience. This was rejected because the blueprint RBAC model uses `roles`, `permissions`, `user_roles`, and `role_permissions`, and users may later have multiple roles.

### Use bcrypt for password hashing

Registration will hash passwords with bcrypt before saving `password_hash`, and login will verify submitted passwords against the stored hash.

Rationale: bcrypt is common in NestJS course projects, straightforward to install and debug, and sufficient for this MVP.

Alternative considered: argon2. Argon2 is strong, but bcrypt has lower dependency and teaching friction for this project.

### Use short identity-only JWT access tokens

The login endpoint will return `{ accessToken }`. The signed JWT payload will include only `sub` and `email`; the strategy will map that payload into `req.user = { id, email }`.

Rationale: the token answers "who is calling?" without embedding authorization state. Future RBAC guards will query server-side role and permission records using `req.user.id`, which aligns with ADR 7 and avoids stale role claims.

Alternative considered: embedding roles or permissions in JWT. This was rejected because the blueprint requires server-side authorization checks and permission revocation should take effect even when an older token exists.

### Keep authentication synchronous

Registration, login, and `/auth/me` will be handled synchronously by the Backend API and PostgreSQL. Redis, Kafka, workers, and external systems are not used by this change.

Rationale: authentication foundation does not require asynchronous processing or cache-aside reads. Adding those components now would increase scope without solving the core identity problem.

## Risks / Trade-offs

- Password policy is basic at MVP scope -> Use DTO validation for required length/format now, and leave advanced password rules, reset flows, and account lockout to later security hardening.
- JWT revocation is not implemented -> Keep access-token TTL configurable and rely on future authorization checks for role/permission changes; add refresh/revocation only when session management is in scope.
- Login can be brute-forced without rate limiting -> Keep endpoint behavior correct now and apply Redis-backed rate limiting in a later traffic-protection/security change.
- Prisma introduces a new dependency and generated client -> Add documented scripts and ensure build/test commands include generation where needed.
- Email uniqueness depends on normalization -> Lowercase and trim email before create/login, and enforce a unique index in PostgreSQL.

## Migration Plan

1. Add Prisma configuration and a migration creating the `users` table.
2. Add authentication configuration values such as `JWT_ACCESS_SECRET` and `JWT_ACCESS_TOKEN_TTL`, with non-secret examples in `.env.example`.
3. Add the NestJS auth module, Prisma service/module, DTOs, controller, service, JWT strategy, and guard.
4. Verify local migration and tests against the existing Docker PostgreSQL service.

Rollback strategy: remove the auth module and Prisma integration from the backend, then revert the migration before relying on persisted user data. No existing production data is affected in this local prototype.

## Open Questions

- Should account `status` initially support only `ACTIVE`, or should the first schema also reserve `DISABLED` for future admin moderation?
- What exact token TTL should be used for local development: `15m`, `1h`, or another course-project default?
