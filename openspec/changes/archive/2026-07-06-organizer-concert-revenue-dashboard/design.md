## Context

TicketBox already has the core backend primitives needed for organizer-facing reporting: concerts are scoped by `concert.organizerId`, ticket types already persist `totalQuantity`, `reservedQuantity`, and `soldQuantity`, and orders already persist `status`, `totalAmountVnd`, `paidAt`, and item-level pricing in `order_items`. The frontend organizer dashboard already renders owned concert cards with `Sửa` and `Hủy` actions, and the router already uses nested organizer routes such as `/organizer/concerts/:id/edit` and `/organizer/concerts/:concertId/ticket-types`.

The main constraint is that payment confirmation is not fully implemented yet. The schema supports `Order.status = PAID`, `Order.paidAt`, and `PaymentTransaction`, but the current codebase does not yet provide a full payment completion path that reliably advances orders into paid state and converts reserved quantities into sold quantities. That means the dashboard must be honest about what it can compute today: it can always show ticket inventory distribution and can show paid revenue when paid data exists, but it must not imply that pending or reserved orders are revenue.

This feature affects Organizer users only. It does not change Audience checkout, payment, check-in, notifications, or external gateway integrations.

## Goals / Non-Goals

**Goals:**
- Add an organizer-only revenue dashboard route for a single owned concert.
- Add a `Doanh thu` action to organizer concert cards without changing the existing edit or cancel flows.
- Return a backend DTO that combines concert header data, summary metrics, and ticket-type breakdown in one organizer-scoped response.
- Compute revenue strictly from successful paid orders, while keeping reserved/held tickets separate from sold tickets.
- Reuse the existing NestJS modular structure, Prisma models, JWT auth, RBAC, and organizer ownership checks.

**Non-Goals:**
- No payment integration, callback handling, or ticket issuance changes.
- No new databases, queues, caches, or analytics pipelines.
- No payout, refund, tax, marketing, or export reporting.
- No changes to public concert browsing, checkout, check-in, or mobile flows.
- No requirement to add a real-time reporting channel; request-time aggregation is sufficient for this scope.

## Decisions

### 1. Serve reporting from a dedicated organizer concert endpoint

The backend should expose a dedicated organizer endpoint such as `GET /organizer/concerts/:id/revenue` in the existing organizer concerts module. This keeps the feature aligned with current routing, ownership enforcement, and DTO patterns.

Alternatives considered:
- Reuse `GET /organizer/concerts/:id` and embed reporting into concert detail: rejected because it would mix editing data with reporting data and make the response heavier for existing editor flows.
- Create a separate reporting module unrelated to concerts: rejected because the access rule is still “owned concert only,” which is already implemented cleanly in organizer concert services.

### 2. Use PostgreSQL request-time aggregation instead of a projection table

The dashboard should aggregate directly from existing PostgreSQL tables: `concerts`, `ticket_types`, `orders`, `order_items`, and optionally `users` for paid order list display. This follows the global design rule that PostgreSQL is the source of truth and avoids adding Kafka-driven reporting projections before the payment flow is mature.

Alternatives considered:
- Add Redis-cached organizer statistics immediately: deferred because the current scope is modest and correctness matters more than premature caching.
- Add Kafka analytics projection tables: rejected for now because it introduces architecture and maintenance complexity without enough current data volume to justify it.

### 3. Compute revenue only from paid orders

Revenue must be derived only from successful orders, using `orders.status = PAID` and `orders.paidAt` as the organizer-facing definition of completed payment. Reserved quantities remain operational capacity, not revenue. Summary and per-ticket-type revenue should therefore exclude `PENDING`, `FAILED`, `EXPIRED`, and `CANCELLED` orders.

Alternatives considered:
- Count `PENDING` orders as provisional revenue: rejected because it is misleading and contradicts the assignment’s sales/revenue monitoring intent.
- Use payment transaction rows as the primary reporting source: deferred because payment confirmation flow is not complete yet, and the existing business state still centers on `orders`.

### 4. Build phase 1 around summary cards and ticket-type breakdown

The frontend should prioritize a concert header, summary metrics, and a ticket-type breakdown. A paid order list is useful only if the returned data is clean and not misleading; it should remain optional in the initial response and UI design.

Alternatives considered:
- Make a detailed paid-order table mandatory: deferred because the codebase may legitimately have zero paid rows until payment flow lands.
- Add analytics-heavy views like charts, funnels, or payout tabs: rejected as out of scope for the assignment and current data maturity.

### 5. Keep the organizer card as the entry point

The existing organizer concert card should gain a third organizer-only action, `Doanh thu`, next to `Sửa` and `Hủy`. This is the smallest UX change that makes the dashboard discoverable without changing the create/edit form or public audience cards.

Alternatives considered:
- Add revenue navigation only inside the edit page: rejected because revenue is a read/reporting workflow, not an editing workflow.
- Add revenue access in a global organizer sidebar only: rejected because the report is concert-specific and the card already provides the most natural context.

## Risks / Trade-offs

- [Paid data may be missing in local/demo environments] → The dashboard must clearly separate sold/reserved/remaining metrics and tolerate zero paid revenue without implying a bug in the page itself.
- [Aggregations could grow expensive with many orders] → Start with request-time Prisma aggregation scoped to one owned concert; add short Redis cache later only if real usage shows pressure.
- [Metric definitions could be misunderstood] → Label reserved and sold separately, and compute sell-through from sold quantity rather than reserved quantity.
- [Ownership leaks would be sensitive] → Reuse existing organizer role and owned-concert checks before any reporting query.
- [Order item aggregation may diverge from ticket type counters if payment flow is incomplete] → Prefer ticket type counters for inventory views and paid order items for revenue views, and document the distinction in implementation notes and tests.

## Migration Plan

1. Add the organizer revenue response DTO and endpoint in the existing organizer concerts module.
2. Implement organizer-scoped aggregation over current concert, ticket type, order, and order item tables.
3. Add frontend API/types, route, and revenue page.
4. Add `Doanh thu` button to organizer concert cards linking to the new route.
5. Verify unauthorized access returns `401`, non-organizer or non-owner access is denied, and organizer-owned reporting renders correctly with empty and non-empty sales states.

Rollback is straightforward: remove the new endpoint, route, and card action without requiring schema rollback because this feature should not introduce new tables or columns.

## Open Questions

- Should phase 1 always include a paid-order list, or should the initial UI defer it until payment confirmation flow is implemented and seeded with realistic paid data?
- If organizer statistics later become expensive, do we want to follow the global design direction and add a short Redis cache or projection invalidated by payment success and order expiration events?
