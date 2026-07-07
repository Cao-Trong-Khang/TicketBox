## 1. Response Contract and Read Service

- [x] 1.1 Add order-history response DTOs that exactly match the frontend `OrderHistoryItem[]` shape and contain no payment, provider, QR, Ticket, user, inventory, or idempotency fields (AC: complete mapping; sensitive fields absent).
- [x] 1.2 Implement `OrdersService.getOrderHistory(userId)` with an explicit Prisma `select`, `where: { userId }`, `createdAt DESC`/`id DESC` ordering, and `take: 100` (AC: ownership; deterministic bounded results).
- [x] 1.3 Map Order, Concert, OrderItem, and TicketType values to ISO timestamps, nullable display fields, and `{ ticketTypeName, quantity }` summaries (AC: frontend contract; nullable fields).
- [x] 1.4 Verify the service performs only `findMany` and does not write domain state, touch Redis, or publish Kafka events (AC: read never mutates state).

## 2. Authenticated Controller Endpoint

- [x] 2.1 Add `GET /orders/history` to `OrdersController` with `JwtAuthGuard`, deriving the owner ID only from the authenticated request user (AC: authenticated owned history).
- [x] 2.2 Keep the static history route unambiguous with future parameter routes and return HTTP 200 with a bare array, including `[]` for no orders (AC: frontend contract; empty history).
- [x] 2.3 Apply no creation-style rate limit unless an existing authenticated-read convention is found; document JWT plus the 100-row cap as current protection (AC: bounded endpoint).

## 3. Backend Tests

- [x] 3.1 Add service tests asserting the exact Prisma ownership filter, explicit projection, deterministic ordering, hard cap, and response mapping (AC: ownership; contract; ordering).
- [x] 3.2 Add tests for all five statuses, multiple item summaries, nullable venue/banner fields, and empty results (AC: status and mapping scenarios).
- [x] 3.3 Add negative assertions proving foreign orders and sensitive fields are absent and no mutation/cache/event calls occur (AC: security; read-only behavior).
- [x] 3.4 Add controller/auth coverage proving missing or invalid JWT returns 401 and authenticated identity—not request input—selects history (AC: unauthenticated and owned access).
- [x] 3.5 Run existing order-creation and expiration tests as regression gates (AC: preserved existing behavior).

## 4. Deterministic Demo Seed

- [x] 4.1 Add a focused history-seed helper that resolves `audience@ticketbox.local` plus existing seeded concerts and active ticket types (AC: first seed run).
- [x] 4.2 Upsert five `DEMO-HISTORY-*` orders with fixed timestamps, stable idempotency keys, valid totals, and PENDING/PAID/FAILED/EXPIRED/CANCELLED statuses (AC: all statuses; deterministic ordering).
- [x] 4.3 Create-or-update one or more valid OrderItems per fixture without creating PaymentTransaction or Ticket rows or modifying existing check-in demo records (AC: valid item summaries; unsupported domains avoided).
- [x] 4.4 Add a seed-idempotency test or verification script that runs the helper twice and proves stable Order and OrderItem counts (AC: repeated seed run).

## 5. Integration and Documentation

- [x] 5.1 Run backend lint, typecheck/build, focused tests, full backend tests, and the Prisma seed locally with Docker Compose dependencies (AC: locally verifiable implementation).
- [x] 5.2 Log in as `audience@ticketbox.local`, call `GET /orders/history`, and verify the response contains only owned newest-first demo orders in the exact frontend shape (AC: end-to-end owned history).
- [ ] 5.3 Open the frontend `/orders` page and verify all five seeded statuses render without frontend contract changes (AC: Web Application consumer integration).
- [x] 5.4 Document the endpoint, 100-row temporary cap, demo credentials/data namespace, and deferred pagination/payment/detail/ticket/QR scope (AC: bounded contract and non-goals).
