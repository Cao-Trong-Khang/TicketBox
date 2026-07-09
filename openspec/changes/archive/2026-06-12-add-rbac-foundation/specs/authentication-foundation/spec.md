## MODIFIED Requirements

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
