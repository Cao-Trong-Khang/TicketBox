## Purpose

Define the runnable TicketBox repository foundation for the web frontend, backend API, and local Docker development stack.

## Requirements

### Requirement: Repository provides a frontend application foundation

## Specification: Frontend Application Foundation

## Description

The system SHALL provide `/frontend` as a Vite + React + TypeScript web application foundation for Audience and Organizer users. The foundation MUST be runnable locally and in Docker, and MUST prepare route structure and API configuration for future concert browsing, checkout, and organizer administration features.

## Main Flow

1. A developer installs frontend dependencies or runs the frontend container.
2. The Web Application starts through Vite.
3. The Web Application reads its backend API base URL from environment configuration.
4. The Web Application renders a TicketBox shell with route-ready areas for audience and organizer workflows.
5. The Web Application can call the Backend API health endpoint to verify connectivity.

## Failure Scenarios

- If the backend API URL is missing, the frontend MUST use a documented local default.
- If the backend health call fails, the frontend MUST show a non-blocking unavailable state and remain usable as a shell.

## Constraints

- The frontend MUST use Vite, React, and TypeScript.
- The frontend MUST NOT implement fake payment settlement, fake ticket issuance, or fake organizer data that appears authoritative.
- The frontend MUST keep protected future workflows ready for RBAC-driven routing without enforcing client-only authorization as the final authority.

## Acceptance Criteria

#### Scenario: Frontend starts locally
- **WHEN** a developer runs the documented frontend development command
- **THEN** the Vite React TypeScript app MUST start successfully and render the TicketBox web shell

#### Scenario: Frontend uses configured API URL
- **WHEN** the frontend starts with a configured backend API base URL
- **THEN** API calls from the frontend MUST target that configured backend URL

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

### Requirement: Repository provides Docker-based local development

## Specification: Docker Development Stack

## Description

The system SHALL provide Docker files that run the TicketBox local prototype with Web Application, Backend API, PostgreSQL, Redis, and Kafka services. The setup is for local development and course-project demonstration, not production cloud deployment.

## Main Flow

1. A developer copies or uses documented environment defaults.
2. A developer runs the documented Docker Compose command.
3. Docker builds the frontend and backend images.
4. Docker starts PostgreSQL, Redis, Kafka, Backend API, and Web Application services.
5. The developer opens the frontend URL and verifies backend connectivity through the health endpoint.

## Failure Scenarios

- If a service port is already occupied, Docker Compose MUST surface the conflict through normal Compose errors.
- If an infrastructure container is unhealthy or unavailable, dependent application behavior MUST make the failure visible through logs or health checks.
- If Kafka is unavailable, the setup MUST still make clear that async workflows are unavailable and MUST NOT claim that notification, CSV import, AI bio, or analytics workers are functional.

## Constraints

- Docker Compose MUST be local-development oriented.
- The stack MUST include PostgreSQL, Redis, and Kafka to align with the archived architecture.
- The stack MUST NOT introduce new databases, message brokers, cloud-only services, or live external integrations.
- Environment examples MUST avoid committing real secrets.

## Acceptance Criteria

#### Scenario: Docker stack starts
- **WHEN** a developer runs the documented Docker Compose startup command
- **THEN** the frontend, backend, PostgreSQL, Redis, and Kafka services MUST start or report actionable startup errors

#### Scenario: Backend is reachable from frontend container
- **WHEN** the Docker stack is running
- **THEN** the frontend MUST be configured to call the backend service through the Compose network or documented public backend URL

#### Scenario: Local infrastructure matches blueprint
- **WHEN** a developer inspects the Compose services
- **THEN** PostgreSQL, Redis, and Kafka MUST be present as local services supporting future authoritative storage, cache/rate-limit coordination, and asynchronous workflows
