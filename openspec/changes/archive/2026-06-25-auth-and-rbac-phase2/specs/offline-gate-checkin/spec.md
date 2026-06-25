## ADDED Requirements

### Requirement: Organizer manages Check-in Staff assignments
TicketBox SHALL provide Organizer-protected APIs for assigning existing Check-in Staff users to owned concerts and gate labels.

#### Scenario: Organizer assigns Check-in Staff to owned concert
- **WHEN** an Organizer calls `POST /admin/concerts/:concertId/check-in-staff` for an owned concert with `{ user_id, gate_label }`
- **THEN** PostgreSQL MUST store a Check-in Staff assignment
- **THEN** PostgreSQL MUST store an audit log for the assignment

#### Scenario: Organizer lists assigned Check-in Staff
- **WHEN** an Organizer calls `GET /admin/concerts/:concertId/check-in-staff` for an owned concert
- **THEN** the Backend API MUST return assignments for that concert

#### Scenario: Non-owner cannot manage assignments
- **WHEN** an Organizer calls any Check-in Staff assignment endpoint for a concert they do not own
- **THEN** the Backend API MUST reject the request with `403 Forbidden`

#### Scenario: Organizer removes Check-in Staff assignment
- **WHEN** an Organizer calls `DELETE /admin/concerts/:concertId/check-in-staff/:assignmentId` for an owned concert
- **THEN** PostgreSQL MUST remove the assignment
- **THEN** PostgreSQL MUST store an audit log for the removal

### Requirement: Backend checks Check-in Staff assignment for check-in
TicketBox SHALL provide a reusable backend helper to assert whether a Check-in Staff user is assigned to a concert before allowing check-in operations.

#### Scenario: Assigned Check-in Staff passes helper
- **WHEN** check-in service calls `assertCheckInStaffAssigned(userId, concertId)` for an assigned Check-in Staff user
- **THEN** the helper MUST allow the check-in flow to continue

#### Scenario: Unassigned Check-in Staff is denied
- **WHEN** check-in service calls `assertCheckInStaffAssigned(userId, concertId)` for an unassigned Check-in Staff user
- **THEN** the helper MUST reject the operation with an authorization failure