# Tasks: Concert Management Implementation

This list details the required execution steps to implement the Concert Management feature using the NestJS backend and React/Vite frontend.

---

## 1. Database

- [ ] **Task DB-1**: Add `Concert` and `TicketType` models to the Prisma schema. Define indexes on status and foreign keys. (Maps to: *All criteria*)
- [ ] **Task DB-2**: Generate and run the database migration. (Maps to: *All criteria*)
- [ ] **Task DB-3**: Implement a seed script creating the 4 default Vietnamese concerts (Anh Trai Say Hi, Anh Trai Vuot Ngan Chong Gai, Em Xinh Say Hi, Chi Dep Dap Gio Re Song) with 5 ticket types each. (Maps to: *Discovery and Seating Map*)

---

## 2. Backend (NestJS)

- [ ] **Task BE-1**: Create `ConcertModule` and `TicketTypeModule`. Register services and controllers. (Maps to: *All criteria*)
- [ ] **Task BE-2**: Implement `GET /api/concerts` endpoint with Redis caching (`concerts:list` with 5-minute TTL) and fallback to PostgreSQL. (Maps to: *Discovery*)
- [ ] **Task BE-3**: Implement `GET /api/concerts/:id` endpoint merging static details (cached in `concerts:{id}` for 5 minutes) and live ticket counts (cached in `concerts:{id}:tickets` for 30 seconds). (Maps to: *Seating Map*)
- [ ] **Task BE-4**: Implement `POST /api/concerts` (guarded for Organizers) creating the concert and ticket types in a transaction, invalidating `concerts:list`. (Maps to: *Management*)
- [ ] **Task BE-5**: Implement `PUT /api/concerts/:id` and `DELETE /api/concerts/:id` (guarded, checking ownership), invalidating listing and detail caches. (Maps to: *Cancellation*)
- [ ] **Task BE-6**: Implement `GET /api/concerts/:id/stats` endpoint query. (Maps to: *Management*)

---

## 3. Frontend (React + Vite)

- [ ] **Task FE-1**: Configure routes for `/concerts`, `/concerts/:id`, `/admin/concerts`, `/admin/concerts/new`, and `/admin/concerts/:id/edit`. (Maps to: *All criteria*)
- [ ] **Task FE-2**: Implement `ConcertListPage` rendering the grid layout of concert cards. (Maps to: *Discovery*)
- [ ] **Task FE-3**: Implement `ConcertDetailPage` featuring the static details, countdown timers for upcoming sales, and a red banner if cancelled. (Maps to: *Countdown and Cancellation*)
- [ ] **Task FE-4**: Implement `SeatingMapSVG` component parsing and highlighting the SVG zones on hover/click, and disabling sold-out zones. (Maps to: *Seating Map*)
- [ ] **Task FE-5**: Implement Admin forms for concert creation and ticket configuration. (Maps to: *Management*)
