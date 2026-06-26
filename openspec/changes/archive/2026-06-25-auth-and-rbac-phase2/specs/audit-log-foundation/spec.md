## ADDED Requirements

### Requirement: Backend records security audit logs
TicketBox SHALL write PostgreSQL audit logs for role assignment, role removal, Check-in Staff assignment, and Check-in Staff assignment removal.

#### Scenario: Role assignment writes audit log
- **WHEN** an Organizer successfully assigns a role to a user
- **THEN** PostgreSQL MUST contain an audit log for the role assignment action

#### Scenario: Check-in Staff assignment writes audit log
- **WHEN** an Organizer successfully assigns Check-in Staff to an owned concert
- **THEN** PostgreSQL MUST contain an audit log for the Check-in Staff assignment action

#### Scenario: Failed authorization writes no success audit log
- **WHEN** the Backend API denies an admin mutation
- **THEN** PostgreSQL MUST NOT contain a success audit log for that attempted mutation