## ADDED Requirements

### Requirement: Role-based API access
The system SHALL enforce RBAC for Audience, Organizer, and Check-in Staff users on every protected API endpoint. Required endpoint permissions: `concert:read` for public concert reads, `ticket:purchase` for checkout, `concert:manage` for organizer concert mutations, `analytics:read` for organizer statistics, `checkin:scan` for mobile scan validation, and `checkin:sync` for offline sync upload.

#### Scenario: Organizer manages own concert
- **GIVEN** an authenticated Organizer has `concert:manage` permission and owns the concert
- **WHEN** the Organizer submits an update to `PATCH /admin/concerts/{concertId}`
- **THEN** the system MUST allow the update and record an audit entry

#### Scenario: Organizer cannot manage another organizer concert
- **GIVEN** an authenticated Organizer has `concert:manage` permission but does not own the concert
- **WHEN** the Organizer submits an update to `PATCH /admin/concerts/{concertId}`
- **THEN** the system MUST reject the request with `403 Forbidden`

#### Scenario: Check-in staff cannot view revenue
- **GIVEN** an authenticated Check-in Staff user only has `checkin:scan` and `checkin:sync`
- **WHEN** the user requests `GET /admin/concerts/{concertId}/statistics`
- **THEN** the system MUST reject the request with `403 Forbidden`

### Requirement: Permission changes take effect server-side
The system SHALL evaluate permissions using server-side role and permission records, not only client-provided token claims.

#### Scenario: Revoked permission blocks subsequent request
- **GIVEN** a user's Organizer role was revoked after login
- **WHEN** the user calls `POST /admin/concerts`
- **THEN** the system MUST deny the request even if the token still contains stale organizer claims
