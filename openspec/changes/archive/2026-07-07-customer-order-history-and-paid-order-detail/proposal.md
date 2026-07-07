## Why

TicketBox does not yet provide an Audience-facing order-history interface. The immediate goal is to build that frontend experience while backend order-history, payment, ticket issuance, and QR capabilities remain separate dependencies.

## What Changes

- Add a frontend-only authenticated `/orders` page titled “Lịch sử đơn hàng”.
- Add reusable responsive cards showing concert, order, ticket quantity, amount, date, venue, and localized status.
- Add loading, empty, unavailable/error, banner-fallback, and incremental-list UI states.
- Add role-aware AppShell navigation to “Sự kiện” and “Đơn hàng của tôi”.
- Define TypeScript view models, formatting helpers, and a frontend data-source boundary for a future API.
- Use mock orders only in frontend tests; production MUST NOT use hard-coded data or localStorage as authoritative history.
- Defer backend APIs, persistent detail refactoring, payment callbacks/returns, polling, issuance, QR, and notification behavior.
- Preserve `create-order-flow`, including its navigation-state fallback and current exclusion of `GET /orders/:id`.

## Capabilities

### New Capabilities

- `customer-order-history-ui`: Frontend-only history list, localized statuses, responsive/accessibility behavior, and dependency states.

### Modified Capabilities

- `project-foundation`: The authenticated Web Application shell exposes Audience navigation to the history UI without altering Organizer routing.

## Impact

- **Role:** Audience is primary; Organizer and Check-in Staff behavior is unchanged.
- **Frontend only:** React routing, `AppShell`, `frontend/src/features/orders`, styles, and frontend tests.
- **Backend/data:** No NestJS, Prisma, migration, Docker, Redis, Kafka, or database changes. A future authenticated history API is an explicit dependency for real data.
- **Existing specs:** `create-order-flow` and `order-expiration` are not modified; `/orders/:orderId` keeps current behavior.
- **External systems:** No VNPAY, MoMo, Email Provider, AI Model, or Sponsor CSV interaction.
