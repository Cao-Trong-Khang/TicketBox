## Why

TicketBox needs lightweight backend protection during high-traffic ticket sales so login, registration, checkout, and organizer mutation endpoints do not become easy abuse targets. The goal is to reduce bot traffic and repeated requests while keeping the current browsing experience and existing payment, QR, notification, and check-in flows unchanged.

## What Changes

- Add backend rate limiting for the most sensitive API endpoints, including authentication, order creation, and organizer mutation flows.
- Use Redis-backed fixed-window counters so limits are enforced consistently without relying on PostgreSQL for request throttling.
- Apply limits per IP for anonymous auth endpoints and per authenticated user when user identity is available, otherwise fall back to IP-based limiting.
- Return HTTP 429 with the message `Bạn thao tác quá nhanh. Vui lòng thử lại sau.` and include retry-after information when available.
- Keep public concert read endpoints mostly unthrottled in this task and avoid adding CAPTCHA, waiting-room, or queue-based flow changes.

## Capabilities

### New Capabilities

- `api-rate-limiting`: Backend request throttling for sensitive auth, checkout, and organizer-management endpoints with Redis-backed enforcement and 429 responses.

### Modified Capabilities

- None.

## Impact

- Backend API: protect existing auth, order, and organizer controller routes without altering core business logic.
- Infrastructure: rely on the existing Redis cache service for short-lived counters and throttling state.
- Security: reduce abuse pressure on login, registration, and sale-related endpoints while preserving the current TicketBox architecture.
