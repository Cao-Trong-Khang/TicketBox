## Purpose

This capability defines the PostgreSQL-backed RBAC foundation for the three TicketBox user groups from the project brief: Audience users browse concerts and buy tickets, Organizers use the internal admin web application to manage concerts and revenue, and Check-in Staff use the mobile check-in app to scan and sync tickets at event gates. Authorization decisions are evaluated server-side from role and permission records, not from client-side route guards or JWT role claims.

## Requirements

### Requirement: Backend stores role and permission assignments
The system SHALL store role and permission records in PostgreSQL so Audience, Organizer, and Check-in Staff authorization can be evaluated server-side. Users MUST be assignable to one or more roles through `user_roles`.

#### Scenario: RBAC tables exist
- **WHEN** a developer applies RBAC migrations to a clean PostgreSQL schema
- **THEN** the database MUST contain `roles`, `permissions`, `user_roles`, and `role_permissions`

#### Scenario: Seed creates project roles
- **WHEN** a developer runs the RBAC seed script
- **THEN** the database MUST contain roles with codes `AUDIENCE`, `ORGANIZER`, and `CHECKIN_STAFF`

#### Scenario: User can have multiple roles
- **GIVEN** a user exists
- **WHEN** the database assigns the user both `AUDIENCE` and `ORGANIZER` through `user_roles`
- **THEN** both role assignments MUST be stored without changing the `users` table shape

#### Scenario: Duplicate assignments are rejected
- **WHEN** a duplicate role, permission, user-role assignment, or role-permission assignment is inserted
- **THEN** PostgreSQL MUST enforce uniqueness and preserve existing RBAC data

### Requirement: Backend seeds TicketBox permissions
The system SHALL seed granular TicketBox permissions and map them to the TicketBox user-group roles. Organizer users MUST NOT automatically receive ticket-purchase permission unless they also have the `AUDIENCE` role.

#### Scenario: Seed is idempotent
- **WHEN** the RBAC seed script is run multiple times
- **THEN** it MUST upsert roles, permissions, and mappings without creating duplicate records

#### Scenario: Audience permissions match project scope
- **WHEN** the seed script maps the `AUDIENCE` role
- **THEN** `AUDIENCE` MUST be granted `concert:read`, `ticket:purchase`, and `ticket:read_own`

#### Scenario: Organizer permissions match admin scope
- **WHEN** the seed script maps the `ORGANIZER` role
- **THEN** `ORGANIZER` MUST be granted `concert:read`, `concert:create`, `concert:update`, `concert:cancel`, `concert:ticket_type:manage`, and `concert:analytics:read`

#### Scenario: Check-in Staff permissions match mobile scope
- **WHEN** the seed script maps the `CHECKIN_STAFF` role
- **THEN** `CHECKIN_STAFF` MUST be granted `concert:read`, `checkin:preload`, `checkin:scan`, and `checkin:sync`

#### Scenario: Organizer cannot purchase by role alone
- **GIVEN** a user has only the `ORGANIZER` role
- **WHEN** the system evaluates `ticket:purchase`
- **THEN** the permission check MUST fail

#### Scenario: Multi-role organizer can purchase
- **GIVEN** a user has both `ORGANIZER` and `AUDIENCE`
- **WHEN** the system evaluates `ticket:purchase`
- **THEN** the permission check MUST pass

### Requirement: Backend evaluates required permissions from route metadata
The system SHALL provide a `@Permissions()` decorator and `PermissionsGuard` so protected Backend API routes can declare required permissions. `PermissionsGuard` MUST use `req.user.id` from `JwtAuthGuard` and evaluate permissions from PostgreSQL, not from JWT claims.

#### Scenario: Missing token receives unauthorized
- **WHEN** a client calls a permission-protected endpoint without a valid token
- **THEN** the Backend API MUST return `401 Unauthorized`

#### Scenario: Missing permission receives forbidden
- **GIVEN** a logged-in user has no role granting `concert:create`
- **WHEN** the user calls an endpoint protected by `@Permissions('concert:create')`
- **THEN** the Backend API MUST return `403 Forbidden`

#### Scenario: Granted permission allows request
- **GIVEN** a logged-in user has a role granting `concert:create`
- **WHEN** the user calls an endpoint protected by `@Permissions('concert:create')`
- **THEN** the Backend API MUST process the request successfully

#### Scenario: JWT remains identity-only
- **GIVEN** a user logs in successfully
- **WHEN** the access token payload is decoded
- **THEN** the token MUST contain identity claims and MUST NOT contain role or permission claims

#### Scenario: Permission lookup fails closed
- **WHEN** permission data cannot be loaded from PostgreSQL
- **THEN** the Backend API MUST fail clearly and MUST NOT grant access by default

### Requirement: TicketBox access points map to the project user groups
Protected TicketBox surfaces SHALL use RBAC consistently with the project brief: Audience-only purchase and own-ticket reads, Organizer-only internal admin web actions, and Check-in Staff-only mobile check-in actions. RBAC MUST be combined with domain checks for resources that are not globally accessible, such as organizer ownership of concerts and staff assignment to a concert or gate.

#### Scenario: Audience cannot access organizer administration
- **GIVEN** a user has only the `AUDIENCE` role
- **WHEN** the user calls an Organizer admin mutation such as `POST /admin/concerts`
- **THEN** the Backend API MUST return `403 Forbidden`

#### Scenario: Organizer cannot scan tickets by role alone
- **GIVEN** a user has only the `ORGANIZER` role
- **WHEN** the user calls a mobile check-in endpoint protected by `checkin:scan`
- **THEN** the Backend API MUST return `403 Forbidden`

#### Scenario: Check-in Staff cannot access admin revenue
- **GIVEN** a user has only the `CHECKIN_STAFF` role
- **WHEN** the user requests Organizer revenue analytics
- **THEN** the Backend API MUST return `403 Forbidden`

#### Scenario: Assigned Check-in Staff can use mobile check-in
- **GIVEN** a user has the `CHECKIN_STAFF` role and is assigned to the target concert or gate
- **WHEN** the user preloads check-in data, validates a QR code, or syncs offline scans for that assignment
- **THEN** the Backend API MUST allow the request subject to normal ticket validity and conflict rules

#### Scenario: Staff-only user is mobile-only
- **GIVEN** a user has only the `CHECKIN_STAFF` role
- **WHEN** the user attempts to establish or use an admin web session
- **THEN** the Web Application and Backend API MUST prevent Organizer admin access
