## Why

TicketBox needs a public concert listing endpoint so audience users can quickly discover upcoming published concerts without exposing internal draft or historical data. This is important now because the frontend needs a read-heavy, low-latency entry point that fits the project architecture and can later be reused by cache-aware browsing screens.

## What Changes

- Add a public `GET /concerts` endpoint for listing upcoming published concerts.
- Return only concerts with published status and future start times.
- Include the lowest active ticket price per concert in the list response.
- Exclude large seating map SVG data from the list response to keep the payload lightweight.
- Add cache-aside behavior for this public read-heavy API so PostgreSQL remains the source of truth while Redis improves response latency.
- Keep the endpoint unauthenticated unless the project later introduces a global auth guard that requires an explicit public-route marker.

## Capabilities

### New Capabilities

- `public-concerts-list`: Public browsing API for upcoming published concerts, including cached list responses and ticket-price summary data.

### Modified Capabilities

- None.

## Impact

- Backend API: new `concerts` module, controller, and service in the NestJS monolith.
- Data access: Prisma query against `Concert` and `TicketType` with PostgreSQL as the source of truth.
- Caching: Redis cache-aside for the public concert list response.
- Frontend integration: provides the audience-facing discovery endpoint for concert browsing.
- Security: remains public by default; no auth/rbac behavior changes are required for the current codebase.
