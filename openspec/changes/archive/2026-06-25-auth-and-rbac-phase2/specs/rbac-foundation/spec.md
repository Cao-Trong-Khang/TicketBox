## ADDED Requirements

### Requirement: Backend exposes role catalog
TicketBox SHALL provide a protected role catalog endpoint that returns roles with permission codes and descriptions.

#### Scenario: Authenticated user reads roles
- **WHEN** an authenticated user calls `GET /roles`
- **THEN** the Backend API MUST return all roles with permission codes and descriptions

### Requirement: Organizer manages user roles
TicketBox SHALL provide Organizer-protected APIs for listing, assigning, and removing user roles with audit logging.

#### Scenario: Organizer lists user roles
- **WHEN** an Organizer calls `GET /admin/users/:userId/roles`
- **THEN** the Backend API MUST return the target user's assigned roles

#### Scenario: Organizer assigns role
- **WHEN** an Organizer calls `POST /admin/users/:userId/roles` with `{ role_code }`
- **THEN** PostgreSQL MUST store the role assignment
- **THEN** PostgreSQL MUST store an audit log for the assignment

#### Scenario: Duplicate role assignment is rejected
- **WHEN** an Organizer tries to assign a role the user already has
- **THEN** the Backend API MUST reject the request with `409 Conflict`

#### Scenario: Organizer removes role
- **WHEN** an Organizer calls `DELETE /admin/users/:userId/roles/:roleCode`
- **THEN** PostgreSQL MUST remove the role assignment
- **THEN** PostgreSQL MUST store an audit log for the removal