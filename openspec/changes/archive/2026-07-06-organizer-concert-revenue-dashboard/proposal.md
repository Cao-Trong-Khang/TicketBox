## Why

Organizer users can already create concerts, configure ticket types, and manage the organizer dashboard, but they still do not have a focused screen for viewing ticket sales and revenue per concert. The assignment scope explicitly includes sales and revenue monitoring, and the current codebase already has enough concert, ticket type, and order data to support a practical first dashboard without changing checkout or payment behavior.

## What Changes

- Add an organizer revenue dashboard page for a single owned concert, reachable from the organizer concert card.
- Add a new organizer backend endpoint that returns concert header data, summary sales metrics, and ticket-type sales breakdown scoped to organizer-owned concerts.
- Add a `Doanh thu` action to organizer concert cards while preserving the existing `Sửa` and `Hủy` flows and leaving the edit form unchanged.
- Reuse existing order, ticket type, and organizer ownership rules so revenue is counted only from successful paid orders and reserved tickets remain separate from sold tickets.
- Keep paid-order listing optional and limited to fields already supported cleanly by the current schema and services.

## Capabilities

### New Capabilities
- `organizer-revenue-dashboard`: Allow organizers to open a per-concert dashboard showing sales and revenue metrics derived from existing concert, ticket type, and order data.

### Modified Capabilities
- `organizer-concert-management`: Update the organizer concert dashboard card actions so organizer cards include `Doanh thu` alongside `Sửa` and `Hủy`, without restoring the audience `Xem chi tiết` action.

## Impact

- Backend organizer concerts module, DTOs, and Prisma queries for organizer-owned reporting data.
- Frontend organizer concert card, organizer routing, organizer API helpers, and a new revenue dashboard page.
- Organizer-facing metrics will rely on existing `orders`, `order_items`, and `ticket_types` data, without adding external payment, notification, or check-in integrations.
