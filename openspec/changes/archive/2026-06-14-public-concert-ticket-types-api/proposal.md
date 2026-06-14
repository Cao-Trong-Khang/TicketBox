## Why

Audience users need a near-realtime list of ticket types when viewing a concert detail page. TicketBox already has public concert list and detail APIs, but ticket type data changes more frequently because of inventory reservations and sales windows, so it needs its own endpoint and cache policy.

## What Changes

- Add a public `GET /concerts/:id/ticket-types` endpoint for published concerts.
- Return active ticket types only, with availability-oriented fields for frontend display.
- Compute `availableQuantity` from authoritative quantity fields and clamp invalid negative values to zero.
- Keep the endpoint public and reuse the existing `ConcertsModule` and `RedisCacheService`.
- Add short-lived Redis cache-aside behavior so the endpoint remains fast without being the source of truth.
- Keep checkout, order creation, payment, WebSocket, and auth/rbac behavior out of scope for this task.

## Capabilities

### New Capabilities

- `public-concert-ticket-types`: Public browsing API for ticket types of a published concert, with short-lived cached DTO responses for near-realtime display.

### Modified Capabilities

- None.

## Impact

- Backend API: extend the existing `concerts` module with a ticket-types route and service method.
- Data access: Prisma query against `Concert` and `TicketType` with PostgreSQL as the source of truth.
- Caching: Redis cache-aside for a short-lived public ticket-types response.
- Frontend integration: supports the concert detail page section that renders ticket tiers and availability.
- Security: endpoint remains public in the current codebase and does not require auth/rbac changes.
