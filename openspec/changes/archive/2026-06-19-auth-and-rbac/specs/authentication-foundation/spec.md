## MODIFIED Requirements

### Requirement: Backend provides user registration

## Specification: Authentication Registration

## Description

The system SHALL allow a new Audience user account to register through the Backend API. Registration is public, MUST normalize the email, MUST hash the password with bcrypt, MUST assign the default `AUDIENCE` role through `user_roles`, and MUST return a profile without `password_hash`.

## Main Flow

1. The Web Application submits registration details to `POST /auth/register`.
2. The Backend API validates email, password, full name, and optional phone.
3. The Backend API normalizes the email address.
4. The Backend API hashes the password with bcrypt.
5. The Backend API stores the user identity and password hash in PostgreSQL.
6. The Backend API looks up the `AUDIENCE` role in PostgreSQL.
7. The Backend API creates a `user_roles` assignment linking the new user to `AUDIENCE`.
8. The Backend API returns the created user profile with `roles: ['AUDIENCE']` and without `password_hash`.

## Failure Scenarios

- If the submitted email is invalid or the password fails validation, the Backend API MUST reject the request with a validation error.
- If the normalized email already exists, the Backend API MUST reject the request with `409 Conflict`.
- If PostgreSQL is unavailable, the Backend API MUST fail clearly and MUST NOT report that the user was created.
- If the `AUDIENCE` role is missing, the Backend API MUST fail clearly and MUST NOT create a partially registered user without the default role.

## Constraints

- The `users` table MUST include `id`, `email`, `password_hash`, `full_name`, `phone`, `status`, `created_at`, and `updated_at`.
- The stored password value MUST be a bcrypt hash, not the plaintext password.
- The email value MUST be unique and normalized before persistence.
- Registration MUST create the default role assignment in `user_roles`.
- Registration MUST NOT require a bearer token or RBAC permission.
- Error responses MUST use `{ error, message, status_code }`.

## Acceptance Criteria

#### Scenario: User registers successfully
- **GIVEN** no existing user has the submitted email
- **WHEN** a client submits valid registration details to `POST /auth/register`
- **THEN** the Backend API MUST create a user in PostgreSQL, assign `AUDIENCE`, and return the user profile without `password_hash`

#### Scenario: Duplicate email is rejected
- **GIVEN** a user already exists for a normalized email address
- **WHEN** another registration request submits the same email address
- **THEN** the Backend API MUST reject the request with `409 Conflict`

### Requirement: Backend authenticates users and issues JWT access tokens

## Specification: Authentication Login

## Description

The system SHALL allow registered Audience, Organizer, and Gate Staff users to log in with email and password. Successful login MUST return an access token, refresh token, and user profile with server-loaded roles.

## Main Flow

1. The Web Application submits login credentials to `POST /auth/login`.
2. The Backend API normalizes the email address and finds the user in PostgreSQL.
3. The Backend API verifies the submitted password against the stored bcrypt hash.
4. The Backend API loads the user's roles from PostgreSQL.
5. The Backend API signs a JWT access token with payload `{ user_id, roles, exp }` and a 1 hour TTL.
6. The Backend API creates an opaque refresh token, stores a bcrypt hash in `refresh_tokens`, and sets its expiry.
7. The Backend API returns `access_token`, `refresh_token`, and a user profile with `roles[]`.

## Failure Scenarios

- If the email does not exist, the Backend API MUST reject the request with `401 Unauthorized`.
- If the password is incorrect, the Backend API MUST reject the request with `401 Unauthorized`.
- If the user status is not active, the Backend API MUST reject the request with `401 Unauthorized`.
- If JWT signing configuration is invalid, the Backend API MUST fail clearly during startup or token issuance.

## Constraints

- JWT payload MUST include `user_id`, `roles`, and `exp`.
- JWT access token TTL MUST be 1 hour.
- JWT role claims MUST be treated as UI routing hints and MUST NOT be trusted for final domain authorization.
- Login response MUST include `access_token`, `refresh_token`, and a user profile with `roles[]`.
- Login MUST NOT interact with VNPAY/MoMo, Email Provider, AI Model, Sponsor CSV Files, Redis, Kafka, or Background Workers.
- Error responses MUST use `{ error, message, status_code }`.

## Acceptance Criteria

#### Scenario: Valid credentials return token pair and profile
- **GIVEN** a registered active user exists
- **WHEN** the client submits the correct email and password to `POST /auth/login`
- **THEN** the Backend API MUST return an access token, refresh token, and user profile with roles

#### Scenario: Token contains requested auth payload
- **GIVEN** a user logs in successfully
- **WHEN** the access token payload is decoded by the backend
- **THEN** the payload MUST contain `user_id`, `roles`, and `exp`

### Requirement: Backend exposes current authenticated user identity

## Specification: Authenticated Current User Lookup

## Description

The system SHALL provide `GET /auth/me` for authenticated Audience, Organizer, and Gate Staff users. The endpoint MUST validate the bearer access token and return the current profile from PostgreSQL without exposing `password_hash`.

## Main Flow

1. A client sends `GET /auth/me` with a Bearer JWT access token.
2. `JwtAuthGuard` validates the token signature and expiry.
3. The JWT strategy maps `payload.user_id` to `req.user.id`.
4. The Backend API loads the user and roles from PostgreSQL.
5. The Backend API returns the authenticated user profile without `password_hash`.

## Failure Scenarios

- If the request has no Bearer token, the Backend API MUST reject the request with `401 Unauthorized`.
- If the token is invalid, expired, or signed with the wrong secret, the Backend API MUST reject the request with `401 Unauthorized`.
- If the token payload does not contain a valid `user_id`, the Backend API MUST reject the request with `401 Unauthorized`.
- If the user no longer exists or is inactive, the Backend API MUST reject the request with `401 Unauthorized`.

## Constraints

- `JwtAuthGuard` MUST be reusable by future protected endpoints.
- `req.user` MUST include the authenticated user id.
- `/auth/me` MUST allow any authenticated fixed role.
- `/auth/me` MUST return roles from PostgreSQL, not from token claims alone.
- Error responses MUST use `{ error, message, status_code }`.

## Acceptance Criteria

#### Scenario: Authenticated request returns current user
- **GIVEN** a client has a valid access token from `POST /auth/login`
- **WHEN** the client calls `GET /auth/me` with the token
- **THEN** the Backend API MUST return the current user's profile and roles without `password_hash`

#### Scenario: Missing token is rejected
- **WHEN** a client calls `GET /auth/me` without a Bearer token
- **THEN** the Backend API MUST reject the request with `401 Unauthorized`

## ADDED Requirements

### Requirement: Backend rotates refresh tokens

## Specification: Authentication Refresh

## Description

The system SHALL allow clients to refresh an authenticated session using an opaque refresh token. The Backend API MUST revoke the old refresh token and issue a new access token and refresh token pair.

## Main Flow

1. The client sends `POST /auth/refresh` with a refresh token.
2. The Backend API locates a non-revoked, non-expired refresh-token record for the user.
3. The Backend API verifies the submitted refresh token against the stored bcrypt hash.
4. The Backend API sets `revoked_at` on the old refresh-token record.
5. The Backend API loads current roles from PostgreSQL.
6. The Backend API issues a new 1 hour JWT access token and a new opaque refresh token.
7. The Backend API stores the new refresh-token bcrypt hash and returns the new token pair.

## Failure Scenarios

- If the refresh token is missing, unknown, expired, revoked, or hash verification fails, the Backend API MUST reject the request with `401 Unauthorized`.
- If the user no longer exists or is inactive, the Backend API MUST reject the request with `401 Unauthorized`.
- If token rotation persistence fails, the Backend API MUST NOT return a new token pair.

## Constraints

- Refresh tokens MUST be stored only as bcrypt hashes.
- Refresh rotation MUST revoke the old token by setting `revoked_at`.
- Access tokens minted by refresh MUST include current server-loaded roles.
- Error responses MUST use `{ error, message, status_code }`.

## Acceptance Criteria

#### Scenario: Refresh rotates token
- **GIVEN** a client has a valid non-revoked refresh token
- **WHEN** the client calls `POST /auth/refresh`
- **THEN** the Backend API MUST revoke the old refresh token and return a new access token and refresh token

#### Scenario: Revoked refresh token is rejected
- **GIVEN** a refresh token row has `revoked_at` set
- **WHEN** the client calls `POST /auth/refresh` with that token
- **THEN** the Backend API MUST reject the request with `401 Unauthorized`

### Requirement: Backend logs out authenticated users

## Specification: Authentication Logout

## Description

The system SHALL allow any authenticated user to log out by revoking the submitted refresh token.

## Main Flow

1. The client sends `POST /auth/logout` with a Bearer access token and refresh token.
2. `JwtAuthGuard` validates the access token.
3. The Backend API verifies that the refresh token belongs to the authenticated user.
4. The Backend API sets `revoked_at` on the matching refresh-token record.
5. The Backend API returns `204 No Content`.

## Failure Scenarios

- If the access token is missing or invalid, the Backend API MUST reject the request with `401 Unauthorized`.
- If the refresh token does not belong to the authenticated user, the Backend API MUST reject the request with `401 Unauthorized`.

## Constraints

- Logout MUST allow any authenticated fixed role.
- Logout MUST set `revoked_at` and MUST NOT delete the refresh-token row.
- Successful logout MUST return `204 No Content`.

## Acceptance Criteria

#### Scenario: Logout revokes refresh token
- **GIVEN** an authenticated user has an active refresh token
- **WHEN** the user calls `POST /auth/logout`
- **THEN** the Backend API MUST set `revoked_at` and return `204 No Content`
