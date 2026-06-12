## Why

TicketBox needs a backend authentication foundation so protected APIs can reliably know which user is calling them. This supports the blueprint goal of token-based authentication while leaving role and permission authorization to a later RBAC change.

## What Changes

- Add a backend authentication capability for registering users, logging in, issuing JWT access tokens, and reading the current authenticated user.
- Store user identity and login data in PostgreSQL through Prisma, with password hashes saved instead of plaintext passwords.
- Introduce a `JwtAuthGuard` and JWT strategy that maps token identity claims into `req.user.id` and `req.user.email`.
- Keep authorization out of scope: this change does not add `roles`, `permissions`, `user_roles`, `role_permissions`, permission guards, role assignment, or role claims in JWTs.
- Use the blueprint role terminology for future RBAC: `AUDIENCE`, `ORGANIZER`, and `CHECKIN_STAFF`.

## Capabilities

### New Capabilities

- `authentication-foundation`: Covers user registration, login, password hashing, JWT access token issuance, and authenticated current-user lookup.

### Modified Capabilities

- None.

## Impact

- Affected roles: Audience, Organizer, and Check-in Staff all benefit from the shared identity foundation, but this change does not enforce role-specific access.
- Affected backend areas: NestJS modules under `/backend/src`, configuration, Prisma schema/migrations, and authentication-related tests.
- Affected APIs: adds `POST /auth/register`, `POST /auth/login`, and protected `GET /auth/me`.
- Dependencies: adds Prisma/PostgreSQL access, bcrypt password hashing, Passport JWT integration, and JWT signing support.
- External systems: no interaction with VNPAY/MoMo, Email Provider, AI Model, or Sponsor CSV Files.
- Supported blueprint constraints: PostgreSQL remains the authoritative source of truth for users, JWTs authenticate clients, and final authorization remains server-side for a later RBAC implementation.
