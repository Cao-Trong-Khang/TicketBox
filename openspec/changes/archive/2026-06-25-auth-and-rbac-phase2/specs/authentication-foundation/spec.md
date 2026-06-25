## MODIFIED Requirements

### Requirement: Backend authenticates users and issues JWT access tokens
The system SHALL allow registered users to log in with email and password. Successful login MUST return a JWT access token that identifies the caller without embedding RBAC role or permission data, and MUST also return an opaque refresh token for future session rotation.

#### Scenario: Valid credentials return access and refresh tokens
- **GIVEN** a registered active user exists
- **WHEN** the client submits the correct email and password to `POST /auth/login`
- **THEN** the Backend API MUST return `{ accessToken, refreshToken }`

#### Scenario: Invalid credentials are rejected
- **GIVEN** a registered user exists
- **WHEN** the client submits an incorrect password to `POST /auth/login`
- **THEN** the Backend API MUST reject the request with `401 Unauthorized`

#### Scenario: Token contains only identity claims
- **GIVEN** a user logs in successfully
- **WHEN** the access token payload is decoded by the backend
- **THEN** the payload MUST contain `sub` and `email` and MUST NOT contain role or permission claims