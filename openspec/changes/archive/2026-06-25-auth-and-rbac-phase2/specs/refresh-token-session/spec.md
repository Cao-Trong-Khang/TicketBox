## ADDED Requirements

### Requirement: Backend persists refresh tokens
TicketBox SHALL store refresh tokens in PostgreSQL so sessions can be refreshed, rotated, and revoked without trusting client-side state.

#### Scenario: Login creates refresh token record
- **WHEN** an active user submits valid credentials
- **THEN** the Backend API MUST store a `refresh_tokens` record with a bcrypt hash
- **THEN** the login response MUST include a refresh token value

#### Scenario: Plain refresh token is not stored
- **WHEN** the database record is inspected after login
- **THEN** `refresh_tokens.token_hash` MUST differ from the plaintext refresh token returned to the client

### Requirement: Backend rotates refresh tokens
TicketBox SHALL provide `POST /auth/refresh` to exchange a valid refresh token for a new access token and a new refresh token while revoking the old refresh token.

#### Scenario: Valid refresh rotates token
- **WHEN** the client calls `POST /auth/refresh` with a valid active refresh token
- **THEN** the Backend API MUST return a new access token and a new refresh token
- **THEN** the old refresh-token record MUST have `revoked_at` set

#### Scenario: Revoked refresh token is rejected
- **WHEN** the client calls `POST /auth/refresh` with a revoked refresh token
- **THEN** the Backend API MUST reject the request with `401 Unauthorized`

#### Scenario: Expired refresh token is rejected
- **WHEN** the client calls `POST /auth/refresh` with an expired refresh token
- **THEN** the Backend API MUST reject the request with `401 Unauthorized`

### Requirement: Backend revokes refresh tokens on logout
TicketBox SHALL provide `POST /auth/logout` so an authenticated user can revoke a refresh token and end that refresh session.

#### Scenario: Logout revokes refresh token
- **WHEN** an authenticated user calls `POST /auth/logout` with an active refresh token
- **THEN** the matching refresh-token record MUST have `revoked_at` set
- **THEN** the Backend API MUST return `204 No Content`