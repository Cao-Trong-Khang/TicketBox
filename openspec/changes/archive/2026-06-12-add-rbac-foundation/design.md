## Context

TicketBox currently has an authentication foundation that creates users, hashes passwords, issues identity-only JWT access tokens, and exposes `req.user.id` through `JwtAuthGuard`. The global blueprint requires server-side RBAC for Audience, Organizer, and Check-in Staff users, with authorization based on database role and permission records rather than token claims.

This change adds the RBAC foundation inside the NestJS modular monolith. It introduces the database model and guard infrastructure needed by later concert, checkout, analytics, and check-in features, while keeping ownership and assignment checks for those domain changes.

## Goals / Non-Goals

**Goals:**

- Add Prisma models and migration for `roles`, `permissions`, `user_roles`, and `role_permissions`.
- Seed roles `AUDIENCE`, `ORGANIZER`, and `CHECKIN_STAFF`.
- Seed granular TicketBox permissions and role-permission mappings.
- Support users with one or more roles through `user_roles`.
- Implement `PermissionService.getUserPermissions(userId)` and `PermissionService.userHasPermissions(userId, requiredPermissions)`.
- Implement `@Permissions()` and `PermissionsGuard` that read required permissions from route metadata and use `req.user.id`.
- Update registration to assign the `AUDIENCE` role by default after creating a user.
- Verify `401`, `403`, and `200` outcomes through sample protected endpoints or tests.

**Non-Goals:**

- Do not add role or permission claims to JWT payloads.
- Do not hard-code roles in controllers as authorization logic.
- Do not implement concert ownership checks, check-in gate assignment checks, or ticket ownership checks in this change.
- Do not add Redis permission caching yet.
- Do not create production admin role-management APIs.
- Do not integrate VNPAY/MoMo, Email Provider, AI Model, Sponsor CSV Files, Redis, Kafka, or Background Workers.

## Decisions

### Use database-backed many-to-many RBAC

RBAC will use:

- `roles`: `id`, `code`, `name`, timestamps.
- `permissions`: `id`, `code`, `description`, timestamps.
- `user_roles`: `user_id`, `role_id`, `created_at`, unique `(user_id, role_id)`.
- `role_permissions`: `role_id`, `permission_id`, `created_at`, unique `(role_id, permission_id)`.

Rationale: this matches the global design and allows users to have multiple roles without duplicating role state in `users`.

Alternative considered: adding `users.role`. Rejected because it conflicts with `user_roles` and prevents multi-role users such as an Organizer who also acts as Audience.

### Keep JWT identity-only

JWT payload remains `{ sub, email }`; `PermissionsGuard` loads permissions from PostgreSQL using `req.user.id`.

Rationale: server-side checks prevent stale token claims from granting access after role changes and preserve the authentication/authorization boundary.

Alternative considered: embedding roles or permissions in JWT. Rejected because the blueprint requires permission changes to take effect server-side.

### Use granular domain permissions

Initial permissions:

- `concert:read`
- `concert:create`
- `concert:update`
- `concert:cancel`
- `concert:ticket_type:manage`
- `concert:analytics:read`
- `ticket:purchase`
- `ticket:read_own`
- `checkin:scan`
- `checkin:sync`

Rationale: granular concert permissions make future controller protection clearer than a broad `concert:manage`.

Alternative considered: using only `concert:manage`. Rejected because it is too coarse for future admin flows and test coverage.

### Role-permission seed mapping

Seed mapping:

- `AUDIENCE`: `concert:read`, `ticket:purchase`, `ticket:read_own`
- `ORGANIZER`: `concert:read`, `concert:create`, `concert:update`, `concert:cancel`, `concert:ticket_type:manage`, `concert:analytics:read`
- `CHECKIN_STAFF`: `concert:read`, `checkin:scan`, `checkin:sync`

Rationale: Organizer users do not automatically get purchase permission. If an organizer should buy tickets, assign both `ORGANIZER` and `AUDIENCE`.

Alternative considered: giving `ticket:purchase` to `ORGANIZER`. Rejected because the blueprint says Organizer purchase is allowed only if also acting as Audience.

### `@Permissions()` requires all listed permissions

`@Permissions('a', 'b')` means the user must have both permissions.

Rationale: all-of semantics are simple, predictable, and appropriate for MVP route protection. If future routes need OR logic, a separate decorator such as `@AnyPermissions()` can be added.

Alternative considered: any-of semantics. Rejected because it is easier to accidentally over-grant access.

### Registration assigns `AUDIENCE` after RBAC exists

After creating a user, registration will assign the `AUDIENCE` role through `user_roles`.

Rationale: registered users should immediately have audience permissions such as public concert reading and ticket purchasing. This is a database role assignment, not a JWT claim.

Alternative considered: leaving new users with no role. Rejected because it creates a poor default for the audience workflow and makes manual role assignment mandatory for ordinary users.

## Risks / Trade-offs

- Missing seed data blocks registration role assignment -> Fail clearly if `AUDIENCE` is missing and document that seed must run after migration.
- Permission checks add database queries per protected request -> Accept for MVP; add Redis or request-scoped caching later if performance requires it.
- Sample RBAC endpoints are not real domain APIs -> Keep them under a clearly named test module and use them only for verification until real domain endpoints exist.
- All-of permission semantics may not cover every future route -> Add a separate any-of decorator later instead of overloading this one.
- Register now depends on RBAC tables -> Keep the dependency explicit and transactional so user creation and default role assignment remain consistent.

## Migration Plan

1. Update Prisma schema with RBAC models and relations to `User`.
2. Create a migration for `roles`, `permissions`, `user_roles`, and `role_permissions`.
3. Add a seed script that upserts roles, permissions, and role-permission mappings.
4. Update registration to create the user and default `AUDIENCE` user role in a transaction.
5. Add RBAC service/decorator/guard and sample protected endpoints.
6. Verify locally with Docker PostgreSQL using a clean schema or reset local volume.

Rollback strategy: revert the RBAC module, registration role-assignment change, seed script, and migration before relying on persisted RBAC data. For local development, reset the Docker PostgreSQL volume and replay remaining migrations.

## Open Questions

- Should sample RBAC endpoints remain in the application after domain endpoints exist, or be removed once real protected APIs are available?
