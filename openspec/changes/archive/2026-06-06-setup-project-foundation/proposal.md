## Why

TicketBox has a completed product blueprint, but the repository does not yet provide runnable application foundations for the web frontend, backend API, or local infrastructure. This change creates the project baseline needed for later feature work to implement the archived requirements consistently.

## What Changes

- Add `/frontend` as a Vite + React + TypeScript web application foundation for the audience area and organizer admin area.
- Add `/backend` as a NestJS TypeScript modular monolith foundation for REST APIs, health checks, configuration, and future domain modules.
- Add local Docker files for the frontend, backend, PostgreSQL, Redis, Kafka, and supporting development orchestration.
- Add environment templates and documentation so contributors can run the stack locally with Docker Compose.
- Keep the setup aligned with the archived TicketBox blueprint: PostgreSQL remains authoritative, Redis supports caching/rate limiting/coordination, and Kafka supports asynchronous workers.

## Capabilities

### New Capabilities

- `project-foundation`: Defines the runnable repository structure, frontend and backend application shells, local Docker Compose stack, and baseline development commands for TicketBox.

### Modified Capabilities

- None.

## Impact

- Affected code: new `/frontend`, `/backend`, Dockerfile(s), Compose files, environment examples, and root-level development documentation/scripts.
- Affected roles: Audience and Organizer through the web application shell; Check-in Staff indirectly through backend API foundations that future mobile sync endpoints will use.
- Affected systems: local PostgreSQL, Redis, and Kafka containers; no live VNPAY/MoMo, Email Provider, AI Model, or Sponsor CSV Files integration is introduced by this setup.
- Supported goals and constraints: local Docker Compose prototype, NestJS modular monolith, Redis and Kafka readiness for high-traffic and asynchronous workflows, and a consistent base for future RBAC, ticketing, payment, notification, AI bio, CSV import, and check-in capabilities.
