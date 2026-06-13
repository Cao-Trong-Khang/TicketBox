## MODIFIED Requirements

### Requirement: Repository provides a NestJS backend foundation

## Specification: Backend API Foundation

## Description

The system SHALL provide `/backend` as a NestJS TypeScript modular monolith foundation for the Backend API. The foundation MUST expose health/config verification, keep infrastructure modules separate from feature modules, and prepare module boundaries for future identity/RBAC, concert management, checkout, payment, ticketing, notifications, check-in, AI artist bio, VIP CSV import, traffic protection, and caching capabilities.

## Main Flow

1. A developer installs backend dependencies or runs the backend container.
2. The Backend API starts through NestJS.
3. `AppModule` imports feature modules from `src/modules`.
4. Feature modules use infrastructure from `src/config` and `src/prisma`.
5. The Backend API loads environment configuration for HTTP port, frontend origin, PostgreSQL, Redis, Kafka, and JWT signing.
6. A client calls the health endpoint.
7. The Backend API returns service status and enough configuration readiness information to verify local setup.

## Failure Scenarios

- If required backend environment variables are missing, the backend MUST fail clearly or use documented local defaults.
- If PostgreSQL, Redis, or Kafka are unavailable during local setup, the backend health response or startup logs MUST make the missing dependency visible.
- If a structural refactor changes route paths, JWT payload shape, auth behavior, RBAC behavior, Prisma schema, migrations, or seed data, the implementation MUST be considered invalid.

## Constraints

- The backend MUST use NestJS and TypeScript.
- The backend MUST follow a modular monolith structure compatible with the archived layered architecture.
- Feature modules SHOULD live under `src/modules`.
- Infrastructure used across feature modules SHOULD live under direct `src` infrastructure folders such as `src/config` and `src/prisma`.
- `common` folders MUST be reserved for generic cross-cutting helpers and MUST NOT become a dumping ground for feature-specific RBAC or authentication vocabulary.
- PostgreSQL MUST remain the planned source of truth for future domain state.
- Redis MUST NOT be treated as authoritative for ticket ownership, payment state, or check-in validity.
- Kafka MUST be reserved for asynchronous workflows and MUST NOT be required for synchronous health-only behavior beyond readiness reporting.

## Acceptance Criteria

#### Scenario: Backend starts locally
- **WHEN** a developer runs the documented backend development command
- **THEN** the NestJS API MUST start successfully and expose a health endpoint

#### Scenario: Backend reports health
- **WHEN** a client requests the backend health endpoint
- **THEN** the backend MUST return a successful response identifying the TicketBox API service

#### Scenario: Backend feature modules are grouped consistently
- **WHEN** a developer inspects backend source structure
- **THEN** feature modules such as auth, RBAC, and health MUST live under `src/modules`
- **AND** shared infrastructure such as Prisma and configuration MUST live outside feature modules

#### Scenario: Structural refactor preserves backend behavior
- **WHEN** the backend module structure is refactored
- **THEN** existing authentication and RBAC tests MUST continue to pass
- **AND** no API route path, JWT payload field, Prisma schema, migration, seed behavior, or permission decision MUST change as part of the refactor
