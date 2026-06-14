## Why

Audience users need a public concert detail page after clicking a concert from the list. The existing list API intentionally omits full concert metadata such as `seatingSvg`, so TicketBox needs a dedicated detail endpoint to keep list responses lightweight while still supporting a richer public detail view.

## What Changes

- Add a public `GET /concerts/:id` endpoint for published concert details.
- Return only concerts with `ConcertStatus.PUBLISHED`; return `404` for missing or unpublished concerts.
- Include concert metadata plus `seatingSvg` in the detail response.
- Exclude internal data such as `organizerId`, `orders`, `tickets`, `payments`, and audit records.
- Add Redis cache-aside behavior for the detail response with a 300-second TTL.
- Reuse the existing `concerts` module and Redis cache service without changing auth or RBAC.
- Keep ticket types and availability out of this endpoint so they can be handled by a separate API with a shorter cache TTL.

## Capabilities

### New Capabilities

- `public-concert-detail`: Public browsing API for a single published concert, including cached metadata and seating SVG data.

### Modified Capabilities

- None.

## Impact

- Backend API: extend the existing `concerts` module with a new detail route and service method.
- Data access: Prisma query against `Concert` with PostgreSQL as the source of truth.
- Caching: Redis cache-aside for the public concert detail response.
- Frontend integration: supports the public concert detail page rendered from the list view.
- Security: endpoint remains public in the current codebase and does not require auth/rbac changes.
