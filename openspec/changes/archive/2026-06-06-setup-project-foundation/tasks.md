## 1. Repository Setup

- [x] 1.1 Review current repository state and confirm no existing `/frontend`, `/backend`, or Docker setup will be overwritten.
- [x] 1.2 Add root documentation for local setup, service URLs, and development commands.
- [x] 1.3 Update root ignore rules for Node, build output, environment files, Docker volumes, and logs.

## 2. Frontend Foundation

- [x] 2.1 Scaffold `/frontend` as a Vite + React + TypeScript application.
- [x] 2.2 Add frontend environment example with backend API base URL and documented local default.
- [x] 2.3 Implement a TicketBox web shell with route-ready Audience and Organizer areas.
- [x] 2.4 Add a non-blocking backend health/status call that uses the configured API URL.
- [x] 2.5 Add frontend scripts for development, build, preview, lint, and type checking.
- [x] 2.6 Verify the frontend starts locally and renders the shell.

## 3. Backend Foundation

- [x] 3.1 Scaffold `/backend` as a NestJS TypeScript application.
- [x] 3.2 Add centralized configuration for HTTP port, frontend origin, PostgreSQL, Redis, and Kafka.
- [x] 3.3 Add CORS configuration compatible with the local frontend.
- [x] 3.4 Implement a health endpoint that identifies the TicketBox API service and reports configuration/readiness basics.
- [x] 3.5 Add module folders or placeholders for future identity/RBAC, concerts, checkout, payments, tickets, notifications, check-in, AI artist bio, VIP CSV import, traffic protection, and caching work.
- [x] 3.6 Add backend scripts for development, build, start, lint, and tests.
- [x] 3.7 Verify the backend starts locally and the health endpoint responds successfully.

## 4. Docker Development Stack

- [x] 4.1 Add a frontend Dockerfile for local development/container startup.
- [x] 4.2 Add a backend Dockerfile for local development/container startup.
- [x] 4.3 Add root Docker Compose configuration for frontend, backend, PostgreSQL, Redis, Kafka, and required Kafka coordination services.
- [x] 4.4 Add Compose environment values and health checks that avoid committing real secrets.
- [x] 4.5 Configure frontend-to-backend communication for Docker networking or documented public backend URL.
- [x] 4.6 Verify `docker compose config` succeeds.
- [x] 4.7 Verify `docker compose up --build` starts the stack or reports actionable dependency/port errors.

## 5. Validation

- [x] 5.1 Run frontend type check/build verification.
- [x] 5.2 Run backend build/test verification.
- [x] 5.3 Verify the frontend can display backend health status when both services are running.
- [x] 5.4 Document any local verification that could not be completed and why.
