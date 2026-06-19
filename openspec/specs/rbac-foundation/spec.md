## Purpose

Define TicketBox role-based access control persistence, seed data, guards, role administration, and server-side authorization checks.

## Requirements

### Requirement: Backend stores role and permission assignments

## Specification: RBAC Persistence Foundation

## Description

The system SHALL store role and permission records in PostgreSQL so Audience, Organizer, and Gate Staff authorization can be evaluated server-side. Users MUST be assignable to one or more roles through `user_roles`.

## Main Flow

1. A developer applies the RBAC Prisma migration.
2. PostgreSQL creates or updates `users`, `roles`, `permissions`, `user_roles`, `role_permissions`, `refresh_tokens`, `audit_logs`, and `gate_staff_assignments`.
3. A developer runs the RBAC seed script.
4. The seed script upserts the fixed roles, TicketBox permissions, and role-permission mappings.
5. Runtime authorization checks read user roles, permissions, ownership, and assignment state from PostgreSQL.

## Failure Scenarios

- If PostgreSQL is unavailable, migration and seeding MUST fail clearly.
- If a duplicate role, permission, user-role assignment, role-permission assignment, or gate-staff assignment is inserted, PostgreSQL MUST enforce uniqueness.
- If the seed script is run multiple times, it MUST remain idempotent and MUST NOT create duplicate records.

## Constraints

- The fixed role codes MUST be `AUDIENCE`, `ORGANIZER`, and `GATE_STAFF`.
- `roles.code` MUST be unique.
- `permissions.code` MUST be unique.
- `user_roles` MUST allow one user to have multiple roles.
- `role_permissions` MUST allow one role to grant multiple permissions.
- `refresh_tokens.token_hash` MUST store bcrypt hashes, not plaintext refresh tokens.
- `gate_staff_assignments` MUST enforce `UNIQUE (concert_id, user_id)`.
- RBAC data MUST use PostgreSQL as the source of truth.

## Acceptance Criteria

#### Scenario: RBAC tables exist
- **WHEN** a developer applies RBAC migrations to a clean PostgreSQL schema
- **THEN** the database MUST contain `roles`, `permissions`, `user_roles`, `role_permissions`, `refresh_tokens`, `audit_logs`, and `gate_staff_assignments`

#### Scenario: Seed creates fixed roles
- **WHEN** a developer runs the RBAC seed script
- **THEN** the database MUST contain roles with codes `AUDIENCE`, `ORGANIZER`, and `GATE_STAFF`

#### Scenario: User can have multiple roles
- **GIVEN** a user exists
- **WHEN** the database assigns the user both `AUDIENCE` and `ORGANIZER` through `user_roles`
- **THEN** both role assignments MUST be stored without changing the `users` table shape

### Requirement: Backend seeds TicketBox permissions

## Specification: RBAC Seed Data

## Description

The system SHALL seed granular TicketBox permissions and map them to the fixed roles. Organizer users MUST NOT automatically receive ticket-purchase permission unless they also have the `AUDIENCE` role.

## Main Flow

1. The seed script upserts permissions for concert, ticket, document, AI bio, and check-in workflows.
2. The seed script maps `AUDIENCE` to audience permissions.
3. The seed script maps `ORGANIZER` to organizer management permissions.
4. The seed script maps `GATE_STAFF` to check-in permissions.
5. The Backend API can evaluate roles and permissions through server-side services.

## Failure Scenarios

- If a required role is missing during permission mapping, the seed script MUST fail clearly.
- If a required permission is missing during permission mapping, the seed script MUST fail clearly.

## Constraints

- Seeded permissions MUST include `concert:read`, `concert:create`, `concert:update`, `concert:cancel`, `concert:stats`, `ticket:purchase`, `ticket:read-own`, `document:upload`, `aibio:read`, `checkin:scan`, and `checkin:sync`.
- `AUDIENCE` MUST be granted `concert:read`, `ticket:purchase`, and `ticket:read-own`.
- `ORGANIZER` MUST be granted `concert:read`, `concert:create`, `concert:update`, `concert:cancel`, `concert:stats`, `document:upload`, and `aibio:read`.
- `GATE_STAFF` MUST be granted `checkin:scan` and `checkin:sync`.
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

## Specification: Role and Permission Guards

## Description

The system SHALL provide reusable guards and decorators so protected Backend API routes can require authentication and fixed roles. API-layer role checks MUST run before controllers, and domain services MUST still perform ownership or assignment checks before sensitive resource operations.

## Main Flow

1. A controller route declares required roles using route metadata.
2. A client calls the route with a Bearer JWT access token.
3. `JwtAuthGuard` validates the JWT signature and expiry and sets `req.user.id`.
4. The role guard checks whether the endpoint accepts any authenticated role or requires a fixed role such as `ORGANIZER` or `GATE_STAFF`.
5. The domain service loads authoritative state from PostgreSQL for ownership or assignment checks where applicable.
6. The Backend API continues only if both the API guard and domain service checks pass.

## Failure Scenarios

- If the request has no valid token, `JwtAuthGuard` MUST reject the request with `401 Unauthorized`.
- If a logged-in user lacks an endpoint-required role, the role guard MUST reject the request with `403 Forbidden`.
- If ownership or assignment data cannot be loaded from PostgreSQL, the Backend API MUST fail clearly and MUST NOT grant access by default.

## Constraints

- Layer 1 API guards MUST verify JWT signature and endpoint role requirements.
- Layer 2 domain services MUST enforce ownership and assignment checks using PostgreSQL.
- Token role claims MUST NOT be trusted for Layer 2 authorization.
- Organizer APIs MUST be scoped by `concert.organizer_id`.
- Gate Staff APIs MUST be scoped by `gate_staff_assignments`.
- Audience ticket APIs MUST be scoped by `ticket.owner_user_id = current_user`.
- Error responses MUST use `{ error, message, status_code }`.

## Acceptance Criteria

#### Scenario: Missing token receives unauthorized
- **WHEN** a client calls a protected endpoint without a token
- **THEN** the Backend API MUST return `401 Unauthorized`

#### Scenario: Missing role receives forbidden
- **GIVEN** a logged-in user has only the `AUDIENCE` role
- **WHEN** the user calls an endpoint requiring `ORGANIZER`
- **THEN** the Backend API MUST return `403 Forbidden`

#### Scenario: Ownership check blocks cross-organizer access
- **GIVEN** an organizer is authenticated
- **WHEN** the organizer calls an admin concert endpoint for a concert owned by another organizer
- **THEN** the domain service MUST reject the request with `403 Forbidden`

### Requirement: Backend exposes roles and permissions

## Specification: Roles Listing

## Description

The system SHALL allow any authenticated Audience, Organizer, or Gate Staff user to list available fixed roles and their permission codes.

## Main Flow

1. A client sends `GET /roles` with a Bearer access token.
2. The Backend API validates the token.
3. The Backend API loads roles and permission codes from PostgreSQL.
4. The Backend API returns roles with permission code arrays.

## Failure Scenarios

- If the bearer token is missing or invalid, the Backend API MUST reject the request with `401 Unauthorized`.
- If role data cannot be loaded, the Backend API MUST fail clearly and MUST NOT return partial invented data.

## Constraints

- `GET /roles` MUST allow any authenticated fixed role.
- Response data MUST come from PostgreSQL seed data.
- Error responses MUST use `{ error, message, status_code }`.

## Acceptance Criteria

#### Scenario: Authenticated user lists roles
- **GIVEN** an authenticated user has any fixed role
- **WHEN** the user calls `GET /roles`
- **THEN** the Backend API MUST return fixed roles with permission codes

### Requirement: Organizer manages user roles

## Specification: Role Administration

## Description

The system SHALL allow an authenticated Organizer to view, assign, and remove fixed roles for users through admin APIs. Successful role mutations MUST write audit logs.

## Main Flow

1. An Organizer sends a request to an `/admin/users/:userId/roles` endpoint with a Bearer access token.
2. The API guard verifies the access token and `ORGANIZER` role.
3. The Backend API loads the target user and requested role from PostgreSQL.
4. For assignment, the Backend API creates a `user_roles` row if it does not already exist.
5. For removal, the Backend API deletes the matching `user_roles` row.
6. The Backend API writes an `audit_logs` record for successful assignment or removal.
7. The Backend API returns the requested response.

## Failure Scenarios

- If the caller is unauthenticated, the Backend API MUST return `401 Unauthorized`.
- If the caller lacks `ORGANIZER`, the Backend API MUST return `403 Forbidden`.
- If assigning a duplicate role, the Backend API MUST return `409 Conflict`.
- If the target user or role does not exist, the Backend API MUST return a not-found error.

## Constraints

- `GET /admin/users/:userId/roles` MUST require `ORGANIZER`.
- `POST /admin/users/:userId/roles` MUST require `ORGANIZER` and body `{ role_code }`.
- `DELETE /admin/users/:userId/roles/:roleCode` MUST require `ORGANIZER`.
- Successful role assignment and removal MUST write `audit_logs`.
- Successful role deletion MUST return `204 No Content`.
- Error responses MUST use `{ error, message, status_code }`.

## Acceptance Criteria

#### Scenario: Organizer assigns role
- **GIVEN** an authenticated Organizer and a target user without `GATE_STAFF`
- **WHEN** the Organizer posts `{ role_code: 'GATE_STAFF' }` to `/admin/users/:userId/roles`
- **THEN** the Backend API MUST create the role assignment and write an audit log

#### Scenario: Duplicate role assignment conflicts
- **GIVEN** a target user already has `ORGANIZER`
- **WHEN** an Organizer posts `{ role_code: 'ORGANIZER' }` to `/admin/users/:userId/roles`
- **THEN** the Backend API MUST return `409 Conflict`

#### Scenario: Organizer removes role
- **GIVEN** a target user has `GATE_STAFF`
- **WHEN** an Organizer deletes `/admin/users/:userId/roles/GATE_STAFF`
- **THEN** the Backend API MUST remove the role, write an audit log, and return `204 No Content`
