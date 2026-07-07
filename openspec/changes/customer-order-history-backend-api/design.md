## Context

The React Order History page already calls `GET /orders/history` and expects a flat `OrderHistoryItem[]`. The NestJS orders module currently supports only order creation and expiration. PostgreSQL already models Order → Concert and Order → OrderItem → TicketType, and `backend/prisma/seed.js` already creates the demo Audience user plus one paid check-in order.

This change fills the synchronous Client-Server read boundary inside the existing layered NestJS modular monolith. The Backend API authenticates and maps data; PostgreSQL is authoritative. Redis, Kafka, workers, mobile check-in, and external systems are not involved.

## Goals / Non-Goals

**Goals:**

- Serve the exact frontend `OrderHistoryItem[]` contract from real owned database rows.
- Enforce ownership by deriving `userId` from the JWT and applying it in the Prisma query.
- Keep reads deterministic, bounded, explicit, and free of sensitive fields or mutations.
- Seed five deterministic status examples for `audience@ticketbox.local` without duplicating rows on rerun.
- Preserve order creation and expiration behavior.

**Non-Goals:**

- Persistent `GET /orders/:orderId` detail.
- Payment initiation/callbacks, ticket issuance, QR delivery, refunds, cancellation commands, or polling.
- Creating PaymentTransaction or Ticket rows for the new history fixtures.
- Frontend pagination, database migrations, caching, Kafka events, or new infrastructure.

## Decisions

### Endpoint and controller ordering

Add `GET /orders/history` before any future parameterized `GET /orders/:orderId` route. Apply `JwtAuthGuard` and read `(req.user as AuthenticatedUser).id`; do not accept query/body ownership input. Return HTTP 200 and a JSON array to match `history-api.ts` exactly.

### Explicit read DTO

Create response DTOs equivalent to:

```ts
type OrderHistoryItemDto = {
  orderId: string;
  orderCode: string;
  status: OrderStatus;
  createdAt: string;
  performanceStartAt: string;
  concertTitle: string;
  venueName: string;
  venueAddress: string | null;
  bannerUrl: string | null;
  totalAmountVnd: number;
  tickets: Array<{ ticketTypeName: string; quantity: number }>;
};
```

The service maps Date values to ISO strings. `tickets` represents order-line summaries, not issued Ticket entities. This naming matches the existing frontend contract while avoiding any issuance claim.

### Prisma projection and ownership

Use one `prisma.order.findMany` call:

- `where: { userId }`
- `orderBy: [{ createdAt: 'desc' }, { id: 'desc' }]`
- `take: 100`
- explicit `select` for Order fields, Concert display fields, and OrderItem quantity plus TicketType name

Do not `include` whole models. Mapping reads `item.ticketType.name` and `item.quantity`; it never reads PaymentTransaction, Ticket, `idempotencyKey`, user data, or inventory counters. Query-level ownership is preferred over fetch-then-filter because foreign rows never enter application memory.

### Temporary bounded array instead of pagination

The frontend currently expects a bare array and has no cursor/metadata UI. The endpoint therefore returns at most the newest 100 owned orders. This protects PostgreSQL and response size without breaking the consumer. Cursor pagination requires a coordinated contract change and is deferred.

### Rate limiting

Do not reuse the strict order-creation limit because history is a normal authenticated read. If the repository has no established authenticated-read policy, omit a new per-endpoint decorator and rely on JWT plus the 100-row hard cap. A future shared API policy can cover it consistently.

### Read-only behavior

The service performs only `findMany`; no transaction, cache invalidation, event, audit mutation, inventory update, or status transition occurs. This makes the endpoint independent of payment-provider and Redis/Kafka availability.

### Deterministic seed strategy

After the Audience user, concerts, and ticket types exist, create five orders with stable order codes and idempotency keys. For each fixture:

1. Resolve an existing seeded concert and active ticket type.
2. `upsert` Order by unique `orderCode`, updating only deterministic demo display/state fields.
3. Find the corresponding OrderItem by `(orderId, ticketTypeId)`; update it if present or create it if absent.
4. Use fixed `createdAt`, `expiresAt`, and status-appropriate `paidAt` timestamps so ordering is obvious.

No new payment or ticket records are created. Existing `DEMO-CHECKIN-ORDER-001` and its payment/tickets remain untouched. The fixture quantities do not adjust inventory counters because these records exist solely to exercise the history read; this limitation is documented for demo data.

### Testing approach

- Unit-test service mapping using a narrow Prisma mock and assert the exact `select`, ownership filter, order, and cap.
- Controller/guard integration coverage proves unauthenticated requests return 401.
- Seed idempotency is verified by running the history-seed helper twice against a controlled Prisma test double or integration database and asserting stable counts.
- Existing create-order and expiration suites remain regression gates.

## Risks / Trade-offs

- **The frontend field `tickets` can be confused with issued tickets** → Document and test that it contains OrderItem summaries only.
- **A 100-row cap can hide older history** → Keep newest-first behavior explicit and add pagination in a coordinated future change.
- **Seed statuses are synthetic without payment rows** → Treat them as display/demo fixtures only; do not infer settlement or issuance.
- **Seed reruns could overwrite user-created demo rows with matching codes** → Reserve a clear `DEMO-HISTORY-*` namespace and document it.
- **The current `@@index([userId])` may sort in memory for large users** → The hard cap and prototype scale are acceptable; add a composite index only with a later pagination/performance change.

## Migration Plan

1. Deploy DTO, service, controller, and tests; no database migration is required.
2. Run the existing Prisma seed to add deterministic history rows.
3. Log in as `audience@ticketbox.local` and verify `/orders` renders the seeded statuses.

Rollback removes the GET route/service method and optional seed helper/fixtures. Existing schema and production records are unchanged.

## Open Questions

None blocking. Pagination and a composite history index are intentionally deferred until the frontend adopts a paginated contract.

