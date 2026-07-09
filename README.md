# TicketBox

TicketBox is a high-concurrency concert ticketing prototype. This repository is organized around the archived OpenSpec blueprint and provides a local development foundation for the web frontend, backend API, and supporting infrastructure.

## Project Layout

- `frontend/` - Vite + React + TypeScript web application shell for Audience and Organizer workflows.
- `backend/` - NestJS + TypeScript modular monolith API foundation.
- `mobile-checkin/` - Android/Kotlin Check-in Staff app for assigned-event preload, offline scans, and scan-log sync.
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

Mobile check-in:

```bash
cd mobile-checkin
gradle test
```

## Offline Check-in Demo

1. Start PostgreSQL, Redis, and Kafka with `docker compose up -d postgres redis kafka`.
2. In `backend/`, run migrations and seed data:

```bash
npm install
npm run prisma:deploy
npm run prisma:seed
npm run start:dev
```

3. Sign in to the mobile app as `checkin@ticketbox.local` with password `Checkin@123456`.
4. Configure the mobile app backend URL with `TICKETBOX_BACKEND_API_URL=http://10.0.2.2:3000/` for the Android emulator, or the host LAN URL for a physical device.
5. Select an assigned event, preload the event data, then scan `qr-ticket-demo-valid-001` or `qr-vip-demo-valid-001`.

The detailed walkthrough, cross-device conflict fixture, and retry fixture are in `docs/offline-checkin-demo.md`.

The mobile staff app walkthrough is in `docs/mobile-checkin-staff-demo.md`. It covers login, assigned event selection, dashboard readiness, QR scan, manual input, duplicate handling, VIP list review, scan history, and logout.

## VIP CSV Import Demo

Sponsor VIP guest-list import fixtures and command sequences are documented in `docs/vip-csv-import-demo.md`. The demo covers valid scheduled CSV import, missing required columns, malformed rows, duplicate rows, and Kafka enqueue failure simulation.

## Current Verification Notes

- `docker compose config` validates the local stack definition.
- `docker compose up -d postgres redis kafka` starts the local PostgreSQL, Redis, and Kafka services when Docker Desktop is available.
- Check-in database verification run locally: `npm run prisma:deploy`, `npm run prisma:seed`, and a Prisma readback confirmed 2 staff assignments, 2 demo tickets, and 2 demo VIP guests.
- Backend check-in verification run locally: `npm test`, `npm run build`, and `npm run lint` pass in `backend/`.
- Mobile check-in unit tests are included under `mobile-checkin/app/src/test`, but they were not run in this environment because `gradle`, `ANDROID_HOME`, and `ANDROID_SDK_ROOT` are not configured.
