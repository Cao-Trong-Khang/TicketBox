## ADDED Requirements

### Requirement: Backend stores role and permission assignments

## Specification: RBAC Persistence Foundation

## Description

The system SHALL store role and permission records in PostgreSQL so Audience, Organizer, and Check-in Staff authorization can be evaluated server-side. Users MUST be assignable to one or more roles through `user_roles`.

## Main Flow

1. A developer applies the RBAC Prisma migration.
2. PostgreSQL creates `roles`, `permissions`, `user_roles`, and `role_permissions`.
3. A developer runs the RBAC seed script.
4. The seed script upserts blueprint roles, TicketBox permissions, and role-permission mappings.
5. Future authorization checks read user permissions from PostgreSQL through Prisma.

## Failure Scenarios

- If PostgreSQL is unavailable, migration and seeding MUST fail clearly.
- If a duplicate role, permission, user-role assignment, or role-permission assignment is inserted, PostgreSQL MUST enforce uniqueness.
- If the seed script is run multiple times, it MUST remain idempotent and MUST NOT create duplicate records.

## Constraints

- The `users` table MUST NOT contain a direct `role` column.
- `roles.code` MUST be unique.
- `permissions.code` MUST be unique.
- `user_roles` MUST allow one user to have multiple roles.
- `role_permissions` MUST allow one role to grant multiple permissions.
- RBAC data MUST use PostgreSQL as the source of truth.

## Acceptance Criteria

#### Scenario: RBAC tables exist
- **WHEN** a developer applies RBAC migrations to a clean PostgreSQL schema
- **THEN** the database MUST contain `roles`, `permissions`, `user_roles`, and `role_permissions`

#### Scenario: Seed creates blueprint roles
- **WHEN** a developer runs the RBAC seed script
- **THEN** the database MUST contain roles with codes `AUDIENCE`, `ORGANIZER`, and `CHECKIN_STAFF`

#### Scenario: User can have multiple roles
- **GIVEN** a user exists
- **WHEN** the database assigns the user both `AUDIENCE` and `ORGANIZER` through `user_roles`
- **THEN** both role assignments MUST be stored without changing the `users` table shape

### Requirement: Backend seeds TicketBox permissions

## Specification: RBAC Seed Data

## Description

The system SHALL seed granular TicketBox permissions and map them to the blueprint roles. Organizer users MUST NOT automatically receive ticket-purchase permission unless they also have the `AUDIENCE` role.

## Main Flow

1. The seed script upserts permissions for concert, ticket, analytics, and check-in workflows.
2. The seed script maps `AUDIENCE` to audience permissions.
3. The seed script maps `ORGANIZER` to organizer management permissions.
4. The seed script maps `CHECKIN_STAFF` to check-in permissions.
5. The Backend API can later evaluate these permissions through `PermissionService`.

## Failure Scenarios

- If a required role is missing during permission mapping, the seed script MUST fail clearly.
- If a required permission is missing during permission mapping, the seed script MUST fail clearly.

## Constraints

- Seeded permissions MUST include `concert:read`, `concert:create`, `concert:update`, `concert:cancel`, `concert:ticket_type:manage`, `concert:analytics:read`, `ticket:purchase`, `ticket:read_own`, `checkin:scan`, and `checkin:sync`.
- `AUDIENCE` MUST be granted `concert:read`, `ticket:purchase`, and `ticket:read_own`.
- `ORGANIZER` MUST be granted `concert:read`, `concert:create`, `concert:update`, `concert:cancel`, `concert:ticket_type:manage`, and `concert:analytics:read`.
- `CHECKIN_STAFF` MUST be granted `concert:read`, `checkin:scan`, and `checkin:sync`.
- `ORGANIZER` MUST NOT receive `ticket:purchase` unless the same user also has `AUDIENCE`.

## Acceptance Criteria

#### Scenario: Organizer cannot purchase by role alone
- **GIVEN** a user has only the `ORGANIZER` role
- **WHEN** the system evaluates `ticket:purchase`
- **THEN** the permission check MUST fail

#### Scenario: Multi-role organizer can purchase
- **GIVEN** a user has both `ORGANIZER` and `AUDIENCE`
- **WHEN** the system evaluates `ticket:purchase`
- **THEN** the permission check MUST pass

### Requirement: Backend evaluates required permissions from route metadata

## Specification: Permissions Guard

## Description

The system SHALL provide a `@Permissions()` decorator and `PermissionsGuard` so protected Backend API routes can declare required permissions. `PermissionsGuard` MUST use `req.user.id` from `JwtAuthGuard` and evaluate permissions from PostgreSQL, not from JWT claims.

## Main Flow

1. A controller route declares required permissions using `@Permissions()`.
2. A client calls the route with a Bearer JWT access token.
3. `JwtAuthGuard` validates the token and sets `req.user.id`.
4. `PermissionsGuard` reads required permission metadata from the route.
5. `PermissionsGuard` calls `PermissionService.userHasPermissions(req.user.id, requiredPermissions)`.
6. The Backend API continues to the controller only if the user has all required permissions.

## Failure Scenarios

- If the request has no valid token, `JwtAuthGuard` MUST reject the request with `401 Unauthorized`.
- If a logged-in user lacks any required permission, `PermissionsGuard` MUST reject the request with `403 Forbidden`.
- If permission data cannot be loaded from PostgreSQL, the Backend API MUST fail clearly and MUST NOT grant access by default.

## Constraints

- `@Permissions()` MUST require all listed permissions.
- `PermissionsGuard` MUST NOT read role or permission claims from JWT.
- `PermissionsGuard` MUST NOT hard-code role checks in controllers.
- `PermissionService.getUserPermissions(userId)` MUST return permission codes granted through all user roles.
- `PermissionService.userHasPermissions(userId, requiredPermissions)` MUST return true only when all required permissions are present.
- Domain ownership and assignment checks are out of scope for this foundation and MUST be enforced by later domain services.

## Acceptance Criteria

#### Scenario: Missing token receives unauthorized
- **WHEN** a client calls a permission-protected test endpoint without a token
- **THEN** the Backend API MUST return `401 Unauthorized`

#### Scenario: Missing permission receives forbidden
- **GIVEN** a logged-in user has no role granting `concert:create`
- **WHEN** the user calls a test endpoint protected by `@Permissions('concert:create')`
- **THEN** the Backend API MUST return `403 Forbidden`

#### Scenario: Granted permission allows request
- **GIVEN** a logged-in user has a role granting `concert:create`
- **WHEN** the user calls a test endpoint protected by `@Permissions('concert:create')`
- **THEN** the Backend API MUST process the request successfully

#### Scenario: JWT remains identity-only
- **GIVEN** a user logs in successfully
- **WHEN** the access token payload is decoded
- **THEN** the token MUST contain identity claims and MUST NOT contain role or permission claims
