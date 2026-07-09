## Purpose

Define the backend authentication foundation for TicketBox so protected APIs can identify the user calling them before later RBAC enforcement is added.

## Requirements

### Requirement: Backend provides user registration

## Specification: Authentication Registration

## Description

The system SHALL allow a new user account to register through the Backend API. After RBAC tables exist, registration MUST assign the new user the `AUDIENCE` role through `user_roles` so the user receives default audience permissions without storing roles in JWTs or in the `users` table.

## Main Flow

1. A client submits registration details to the Backend API.
2. The Backend API validates the submitted email, password, and optional display name.
3. The Backend API normalizes the email address.
4. The Backend API hashes the password with bcrypt.
5. The Backend API stores the user identity and password hash in PostgreSQL through Prisma.
6. The Backend API looks up the `AUDIENCE` role in PostgreSQL.
7. The Backend API creates a `user_roles` assignment linking the new user to `AUDIENCE`.
8. The Backend API returns the created user identity without exposing `password_hash`.

## Failure Scenarios

- If the submitted email is invalid or the password fails validation, the Backend API MUST reject the request with a validation error.
- If the normalized email already exists, the Backend API MUST reject the request with `409 Conflict`.
- If PostgreSQL is unavailable, the Backend API MUST fail clearly and MUST NOT report that the user was created.
- If the `AUDIENCE` role is missing, the Backend API MUST fail clearly and MUST NOT create a partially registered user without the default role.

## Constraints

- The `users` table MUST NOT contain a `role` column.
- The `users` table MUST include `id`, `email`, `password_hash`, `display_name`, `status`, `created_at`, and `updated_at`.
- The stored password value MUST be a bcrypt hash, not the plaintext password.
- The email value MUST be unique and normalized before persistence.
- Registration MUST create the default role assignment in `user_roles` after RBAC tables exist.
- Registration MUST NOT create role or permission claims in JWTs.
- Registration does not require an RBAC permission because it is a public account-creation action.

## Acceptance Criteria

#### Scenario: User registers successfully
- **GIVEN** no existing user has the submitted email
- **WHEN** a client submits valid registration details to `POST /auth/register`
- **THEN** the Backend API MUST create a user in PostgreSQL and return the user identity without `password_hash`

#### Scenario: Password is hashed before storage
- **GIVEN** a client submits a valid password during registration
- **WHEN** the Backend API stores the new user
- **THEN** PostgreSQL MUST contain a bcrypt `password_hash` that differs from the plaintext password

#### Scenario: Duplicate email is rejected
- **GIVEN** a user already exists for a normalized email address
- **WHEN** another registration request submits the same email address
- **THEN** the Backend API MUST reject the request with `409 Conflict`

#### Scenario: Registered user receives default audience role
- **GIVEN** RBAC seed data contains the `AUDIENCE` role
- **WHEN** a client successfully registers a new user
- **THEN** PostgreSQL MUST contain a `user_roles` record assigning the new user to `AUDIENCE`

### Requirement: Backend authenticates users and issues JWT access tokens

## Specification: Authentication Login

## Description

The system SHALL allow registered users to log in with email and password. Successful login MUST return a JWT access token that identifies the caller without embedding RBAC role or permission data.

## Main Flow

1. A client submits login credentials to the Backend API.
2. The Backend API normalizes the email address and finds the user in PostgreSQL through Prisma.
3. The Backend API verifies the submitted password against the stored bcrypt hash.
4. The Backend API signs a JWT access token with payload fields `sub` and `email`.
5. The Backend API returns `{ accessToken }` to the client.

## Failure Scenarios

- If the email does not exist, the Backend API MUST reject the request with `401 Unauthorized`.
- If the password is incorrect, the Backend API MUST reject the request with `401 Unauthorized`.
- If the user status is not active, the Backend API MUST reject the request with `401 Unauthorized`.
- If JWT signing configuration is invalid, the Backend API MUST fail clearly during startup or token issuance.

## Constraints

- JWT payload MUST include `sub: user.id` and `email: user.email`.
- JWT payload MUST NOT include role, permission, ownership, or assignment claims.
- Login response MUST use the shape `{ accessToken }`.
- Login MUST NOT interact with VNPAY/MoMo, Email Provider, AI Model, Sponsor CSV Files, Redis, Kafka, or Background Workers.
- Login does not require an RBAC permission because it is a public authentication action.

## Acceptance Criteria

#### Scenario: Valid credentials return access token
- **GIVEN** a registered active user exists
- **WHEN** the client submits the correct email and password to `POST /auth/login`
- **THEN** the Backend API MUST return `{ accessToken }`

#### Scenario: Invalid credentials are rejected
- **GIVEN** a registered user exists
- **WHEN** the client submits an incorrect password to `POST /auth/login`
- **THEN** the Backend API MUST reject the request with `401 Unauthorized`

#### Scenario: Token contains only identity claims
- **GIVEN** a user logs in successfully
- **WHEN** the access token payload is decoded by the backend
- **THEN** the payload MUST contain `sub` and `email` and MUST NOT contain role or permission claims

### Requirement: Backend exposes current authenticated user identity

## Specification: Authenticated Current User Lookup

## Description

The system SHALL provide a protected API for checking that the Backend API can read the current caller identity from a JWT access token. This endpoint proves that future protected Audience, Organizer, and Check-in Staff APIs can depend on `req.user.id`.

## Main Flow

1. A client sends `GET /auth/me` with a Bearer JWT access token.
2. `JwtAuthGuard` validates the token through the JWT strategy.
3. The JWT strategy maps `payload.sub` and `payload.email` to `req.user.id` and `req.user.email`.
4. The Backend API returns the authenticated user identity.

## Failure Scenarios

- If the request has no Bearer token, the Backend API MUST reject the request with `401 Unauthorized`.
- If the token is invalid, expired, or signed with the wrong secret, the Backend API MUST reject the request with `401 Unauthorized`.
- If the token payload does not contain a valid `sub`, the Backend API MUST reject the request with `401 Unauthorized`.

## Constraints

- `JwtAuthGuard` MUST be reusable by future protected endpoints.
- `req.user` MUST include `id` and `email`.
- `req.user` MUST NOT include roles or permissions in this change.
- `/auth/me` requires authentication but does not require any RBAC permission.
- Future RBAC permissions will be evaluated server-side by querying role and permission records using `req.user.id`.

## Acceptance Criteria

#### Scenario: Authenticated request returns current user
- **GIVEN** a client has a valid access token from `POST /auth/login`
- **WHEN** the client calls `GET /auth/me` with the token
- **THEN** the Backend API MUST return the current user's `id` and `email`

#### Scenario: Missing token is rejected
- **WHEN** a client calls `GET /auth/me` without a Bearer token
- **THEN** the Backend API MUST reject the request with `401 Unauthorized`

#### Scenario: Guard maps token subject to request user id
- **GIVEN** a valid token contains `sub` equal to a registered user's ID
- **WHEN** `JwtAuthGuard` allows the request
- **THEN** downstream route handling MUST be able to read that value from `req.user.id`
