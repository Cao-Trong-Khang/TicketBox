# TicketBox

TicketBox is a high-concurrency concert ticketing prototype. This repository is organized around the archived OpenSpec blueprint and provides a local development foundation for the web frontend, backend API, and supporting infrastructure.

## Project Layout

- `frontend/` - Vite + React + TypeScript web application shell for Audience and Organizer workflows.
- `backend/` - NestJS + TypeScript modular monolith API foundation.
- `docker-compose.yml` - Local development stack with frontend, backend, PostgreSQL, Redis, and Kafka.
- `openspec/` - Product and implementation specifications.

## Service URLs

- Frontend: `http://localhost:5173`
- Backend API: `http://localhost:3000`
- Backend health: `http://localhost:3000/health`
- PostgreSQL: `localhost:5432`
- Redis: `localhost:6379`
- Kafka: `localhost:9092`

## Local Development

Install and run each app directly:

```bash
cd frontend
npm install
npm run dev
```

```bash
cd backend
npm install
npm run start:dev
```

Copy environment examples if you want to override defaults:

```bash
copy frontend\.env.example frontend\.env
copy backend\.env.example backend\.env
```

## Docker Development

Start the full local stack:

```bash
docker compose up --build
```

Validate the Compose file:

```bash
docker compose config
```

The Docker setup is for local development and course-project demonstration only. It does not include production cloud deployment, live payment settlement, or real external integrations.

## Verification

Frontend:

```bash
cd frontend
npm test
npm run typecheck
npm run build
```

Backend:

```bash
cd backend
npm run build
npm test
```

## Current Verification Notes

- `docker compose config` validates the local stack definition.
- `docker compose up --build` requires Docker Desktop with the Linux engine running. If Docker is stopped, Compose reports the missing `dockerDesktopLinuxEngine` pipe before pulling PostgreSQL, Redis, or Kafka images.
