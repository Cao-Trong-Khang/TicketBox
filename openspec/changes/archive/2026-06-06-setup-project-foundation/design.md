## Context

The archived TicketBox blueprint defines a Docker Compose-based local prototype with a Vite/React web application, NestJS modular monolith backend, PostgreSQL, Redis, Kafka, and background workers. The current repository only contains OpenSpec artifacts, so feature work has no runnable frontend, backend, or local infrastructure baseline.

This design establishes the repository foundation without implementing domain-heavy workflows such as checkout, payment callbacks, notification delivery, AI bio processing, CSV import, or offline check-in sync. It prepares the structure those future capabilities can extend.

## Goals / Non-Goals

**Goals:**

- Create `/frontend` as a Vite + React + TypeScript application shell.
- Create `/backend` as a NestJS TypeScript modular monolith shell.
- Provide Dockerfiles and Docker Compose services for local development.
- Include PostgreSQL, Redis, and Kafka in the local stack to match the global architecture.
- Provide baseline health/config endpoints and environment examples so the stack can be verified quickly.
- Keep future module boundaries visible for identity/RBAC, concerts, checkout, payments, tickets, notifications, check-in, AI artist bio, VIP CSV import, traffic protection, and caching.

**Non-Goals:**

- No production cloud deployment or managed infrastructure provisioning.
- No real payment settlement or live VNPAY/MoMo integration.
- No mobile check-in application implementation.
- No database schema for domain tables beyond infrastructure-ready configuration.
- No implementation of high-contention inventory locking, payment idempotency, notification workers, CSV import workers, or AI bio workers.

## Decisions

### Use a Two-App Repository Layout

Create `/frontend` and `/backend` as separate TypeScript projects with their own package manifests, build scripts, Dockerfiles, and lint/test configuration.

Rationale: the blueprint separates Web Application and Backend API containers. Separate app folders keep toolchains clear while preserving a simple repository structure suitable for a course project.

Alternative considered: a single root package workspace. This can be introduced later, but a minimal two-app layout reduces initial setup friction and avoids locking the team into a package manager workspace decision too early.

### Use Vite + React + TypeScript for `/frontend`

The frontend app will provide a runnable web shell with routing-ready structure for audience and organizer areas, API base URL configuration, and a health/status display that can call the backend.

Rationale: Vite gives fast local development, TypeScript aligns with the backend stack, and React fits the requested frontend technology. The shell should be domain-aware enough to guide future screens without pretending to implement finished ticketing workflows.

Alternative considered: adding a full design system immediately. That is premature until the first user-facing feature determines real component needs.

### Use NestJS Modular Monolith for `/backend`

The backend app will expose a health endpoint, centralized configuration, CORS setup for the frontend, and placeholder module directories that reflect the global design. Infrastructure clients for PostgreSQL, Redis, and Kafka can be configured through environment variables without making Redis or Kafka authoritative for business state.

Rationale: the archived design explicitly chooses NestJS modular monolith and layered architecture. Starting with NestJS modules and config conventions prevents later features from scattering domain logic through the app bootstrap.

Alternative considered: a bare Express server. That would be faster to scaffold but contradicts the selected backend architecture.

### Use Docker Compose for Local Runtime

Add a root `docker-compose.yml` that runs frontend, backend, PostgreSQL, Redis, Kafka, and any Kafka coordination service required by the selected Kafka image. The app containers should support development volume mounts and depend on infrastructure health where practical.

Rationale: local execution is in scope and Docker Compose is part of the global proposal. Running dependencies locally allows later traffic, caching, and async worker features to be developed against realistic services.

Alternative considered: documenting local installs for PostgreSQL/Redis/Kafka. That increases contributor setup variance and weakens repeatability.

### Keep Workers as a Future Backend Runtime Mode

The initial backend package should reserve script/config space for a worker process, but the first setup does not need to implement consumers.

Rationale: the blueprint includes NestJS worker processes and Kafka. A reserved runtime mode helps future notification, reminder, CSV import, AI bio, and analytics work fit naturally.

Alternative considered: creating a separate `/worker` app now. That would add structure before there is worker behavior to isolate.

## Risks / Trade-offs

- [Risk] Dockerized Kafka can be heavier than the rest of the local stack. -> Mitigation: use a single-node development configuration and document startup expectations.
- [Risk] Placeholder domain modules can become misleading if they expose fake behavior. -> Mitigation: keep placeholders limited to structure and health/config verification.
- [Risk] Frontend shell may overfit future UX before real screens are specified. -> Mitigation: implement only a small operational shell and route-ready structure.
- [Risk] Environment drift between local and containerized runs can slow contributors down. -> Mitigation: provide `.env.example` files and use the same variable names in Docker Compose and app config.
- [Risk] Infrastructure clients may fail when optional services are not ready. -> Mitigation: health endpoint should report service configuration/readiness clearly without masking startup errors for required local dependencies.

## Migration Plan

1. Add the frontend, backend, Docker, and environment files to the empty repository.
2. Verify local app commands run outside Docker where possible.
3. Verify `docker compose up --build` starts the web, API, PostgreSQL, Redis, and Kafka stack.
4. Keep rollback simple: remove the added `/frontend`, `/backend`, Docker, and environment files if the setup needs to be replaced.

## Open Questions

- Which package manager should become the long-term standard if the team later introduces a root workspace?
- Should Kafka remain in every local dev startup profile, or should it move behind an optional Compose profile once worker-heavy features are implemented?
