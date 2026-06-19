## ADDED Requirements

### Requirement: Organizer manages gate-staff assignments for owned concerts

## Specification: Gate Staff Assignment

## Description

The system SHALL allow an authenticated Organizer to assign Gate Staff users to gates for concerts the Organizer owns. This capability is used by Organizer users in the Web Application and by the Backend API to scope later Gate Staff check-in and offline sync actions.

## Main Flow

1. The Organizer uses the Web Application to manage gate staff for a concert.
2. The Web Application calls `/admin/concerts/:concertId/gate-staff` with a Bearer access token.
3. The API guard verifies the token and requires `ORGANIZER`.
4. The domain service loads the concert from PostgreSQL and verifies `concert.organizer_id = current_user`.
5. For assignment creation, the service validates body `{ user_id, gate_label }`, verifies the user exists, and creates a `gate_staff_assignments` row.
6. For listing, the service returns assignments for the owned concert.
7. For deletion, the service deletes the requested assignment belonging to the owned concert.
8. Successful create and delete operations write `audit_logs`.

## Failure Scenarios

- If the bearer token is missing or invalid, the Backend API MUST return `401 Unauthorized`.
- If the caller lacks `ORGANIZER`, the Backend API MUST return `403 Forbidden`.
- If the concert is not owned by the caller, the domain service MUST return `403 Forbidden`.
- If the target user or assignment does not exist, the Backend API MUST return a not-found error.
- If the same user is already assigned to the same concert, the Backend API MUST return `409 Conflict`.
- If `gate_label` is missing or invalid, the Backend API MUST return a validation error.

## Constraints

- `POST /admin/concerts/:concertId/gate-staff` MUST require `ORGANIZER` and a Layer 2 ownership check.
- `GET /admin/concerts/:concertId/gate-staff` MUST require `ORGANIZER` and a Layer 2 ownership check.
- `DELETE /admin/concerts/:concertId/gate-staff/:assignmentId` MUST require `ORGANIZER` and a Layer 2 ownership check.
- `gate_staff_assignments` MUST include `id`, `concert_id`, `user_id`, `gate_label`, and `assigned_at`.
- `gate_staff_assignments` MUST enforce `UNIQUE (concert_id, user_id)`.
- Successful assignment creation MUST return `201 Created`.
- Successful deletion MUST return `204 No Content`.
- Successful creation and deletion MUST write `audit_logs`.
- Error responses MUST use `{ error, message, status_code }`.

## Acceptance Criteria

#### Scenario: Organizer assigns gate staff to owned concert
- **GIVEN** an authenticated Organizer owns a concert and a target user exists
- **WHEN** the Organizer calls `POST /admin/concerts/:concertId/gate-staff` with `{ user_id, gate_label }`
- **THEN** the Backend API MUST create the assignment, write an audit log, and return `201 Created`

#### Scenario: Organizer lists assignments for owned concert
- **GIVEN** an authenticated Organizer owns a concert with gate-staff assignments
- **WHEN** the Organizer calls `GET /admin/concerts/:concertId/gate-staff`
- **THEN** the Backend API MUST return the assignments for that concert

#### Scenario: Non-owner cannot manage assignments
- **GIVEN** an authenticated Organizer does not own a concert
- **WHEN** the Organizer calls a gate-staff assignment endpoint for that concert
- **THEN** the Backend API MUST return `403 Forbidden`

#### Scenario: Organizer removes gate-staff assignment
- **GIVEN** an authenticated Organizer owns a concert with an assignment
- **WHEN** the Organizer calls `DELETE /admin/concerts/:concertId/gate-staff/:assignmentId`
- **THEN** the Backend API MUST delete the assignment, write an audit log, and return `204 No Content`

### Requirement: Gate Staff authorization is scoped by assignment

## Specification: Gate Staff Assignment Checks

## Description

The system SHALL provide server-side assignment checks so Gate Staff users can scan QR codes and sync offline check-ins only for assigned concerts and gates.

## Main Flow

1. A Gate Staff user calls a future check-in scan or sync endpoint with a Bearer access token.
2. The API guard verifies the token and requires `GATE_STAFF`.
3. The domain service loads `gate_staff_assignments` from PostgreSQL for the current user.
4. The domain service compares the requested concert and gate scope with the assignment.
5. The Backend API allows the check-in operation only when the assignment matches.

## Failure Scenarios

- If the caller lacks `GATE_STAFF`, the Backend API MUST return `403 Forbidden`.
- If the caller has no assignment for the requested concert, the domain service MUST return `403 Forbidden`.
- If the caller is assigned to a different gate label for the requested concert, the domain service MUST return `403 Forbidden`.

## Constraints

- Token claims MUST NOT be trusted for assignment checks.
- Assignment checks MUST use PostgreSQL as the source of truth.
- Assignment checks MUST support scoping by assigned concert IDs or gate labels.

## Acceptance Criteria

#### Scenario: Assigned staff can pass assignment check
- **GIVEN** a Gate Staff user is assigned to a concert and gate label
- **WHEN** a check-in domain service checks access for that concert and gate label
- **THEN** the assignment check MUST pass

#### Scenario: Unassigned staff is forbidden
- **GIVEN** a Gate Staff user is not assigned to a concert
- **WHEN** a check-in domain service checks access for that concert
- **THEN** the assignment check MUST fail with `403 Forbidden`
