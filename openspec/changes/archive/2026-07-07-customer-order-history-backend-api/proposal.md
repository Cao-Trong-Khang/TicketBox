## Why

The completed Audience Order History UI calls `GET /orders/history`, but the orders module currently exposes only `POST /orders`, so authenticated users cannot load real history data. TicketBox needs a small, ownership-scoped read capability plus deterministic demo records to make the UI functional without expanding into payment, ticket issuance, or persistent order-detail work.

## What Changes

- Add JWT-protected `GET /orders/history` to the existing NestJS orders module.
- Return the exact flat `OrderHistoryItem[]` contract consumed by the frontend, using explicit Prisma projections across Order, Concert, OrderItem, and TicketType.
- Scope every query to the authenticated JWT user, order results by `createdAt DESC, id DESC`, and keep the operation read-only.
- Temporarily cap the unpaginated response at 100 orders because the current frontend expects a JSON array and has no pagination contract; pagination is deferred to a coordinated frontend/backend change.
- Apply the existing authenticated read rate-limit convention only if one is already established; otherwise rely on JWT plus the hard cap and document the decision.
- Add idempotent seed records for PENDING, PAID, FAILED, EXPIRED, and CANCELLED orders owned by `audience@ticketbox.local`, reusing existing concerts and ticket types.
- Add service/controller and seed-idempotency tests while preserving `POST /orders` and order-expiration behavior.
- Do not add `GET /orders/:orderId`, payment processing, callbacks, provider integration, ticket issuance, QR delivery, refunds, cancellations, or frontend polling.

## Capabilities

### New Capabilities

- `customer-order-history-api`: Authenticated, ownership-scoped order-history reads and deterministic local demo history data for the existing frontend consumer.

### Modified Capabilities

None. Existing `create-order-flow` and `order-expiration` requirements remain unchanged.

## Impact

- **Users:** Audience users can read only their own history. Organizer users may read orders they personally own when authenticated, consistent with ownership-based access; Check-in Staff receives no new operational capability.
- **Backend:** Extends `OrdersController` and `OrdersService`, adds response DTOs/tests, and retains the NestJS modular-monolith/layered structure.
- **Database:** Uses existing PostgreSQL tables and indexes; no schema migration is expected. Seed data adds deterministic Order/OrderItem rows only.
- **Frontend:** `frontend/src/features/orders/history-api.ts` consumes the endpoint without contract changes.
- **Security:** JWT identity is authoritative; no client user ID is accepted and no sensitive payment/ticket fields are selected or serialized.
- **External systems:** No interaction with VNPAY, MoMo, Email Provider, AI Model, Sponsor CSV Files, Kafka, or Redis is introduced.
- **Global constraints:** PostgreSQL remains authoritative, reads never mutate inventory or state, and existing concurrency/expiration safeguards are preserved.
