## 1. Data Access and Configuration

- [x] 1.1 Add Prisma dependencies, Prisma scripts, and generated-client setup for the backend.
- [x] 1.2 Add a Prisma schema using PostgreSQL and define the `users` model with `id`, `email`, `password_hash`, `display_name`, `status`, `created_at`, and `updated_at`, with a unique normalized email.
- [x] 1.3 Create and verify the initial Prisma migration for the `users` table against the local Docker PostgreSQL service.
- [x] 1.4 Add JWT and database environment examples, including `DATABASE_URL`, `JWT_ACCESS_SECRET`, and `JWT_ACCESS_TOKEN_TTL`.
- [x] 1.5 Add a backend Prisma module/service that can be injected into feature modules.

## 2. Authentication Module

- [x] 2.1 Add authentication dependencies for bcrypt, JWT signing, Passport JWT strategy, and request validation.
- [x] 2.2 Implement DTO validation for registration and login input.
- [x] 2.3 Implement registration to normalize email, reject duplicates with `409 Conflict`, hash passwords with bcrypt, store the user, and omit `password_hash` from responses.
- [x] 2.4 Implement login to validate email/password, reject invalid credentials with `401 Unauthorized`, reject inactive users, and return `{ accessToken }`.
- [x] 2.5 Sign JWT access tokens with only `sub` and `email` claims.

## 3. Guard and Current User API

- [x] 3.1 Implement JWT strategy that validates Bearer tokens and maps payload `{ sub, email }` to `req.user = { id, email }`.
- [x] 3.2 Implement reusable `JwtAuthGuard` for protected NestJS endpoints.
- [x] 3.3 Implement `GET /auth/me` protected by `JwtAuthGuard`, returning the current user's `id` and `email`.
- [x] 3.4 Register the auth module in the backend application module without adding RBAC roles, permissions, role assignments, or role claims.

## 4. Tests and Verification

- [x] 4.1 Add tests or demo coverage proving successful registration stores a bcrypt hash and does not expose `password_hash`.
- [x] 4.2 Add tests or demo coverage proving duplicate registration returns `409 Conflict`.
- [x] 4.3 Add tests or demo coverage proving successful login returns `{ accessToken }` and invalid login returns `401 Unauthorized`.
- [x] 4.4 Add tests or demo coverage proving JWT payload contains `sub` and `email` but no role or permission claims.
- [x] 4.5 Add tests or demo coverage proving `/auth/me` returns `id` and `email` with a valid token and returns `401 Unauthorized` without a token.
- [x] 4.6 Run backend build/test commands and verify the implementation works locally with Docker Compose PostgreSQL.
