## Context

TicketBox already uses NestJS in a modular monolith and already has a Redis cache service that supports short-lived counters through `incrementWithTtl`. The backend needs a lightweight protection layer for abuse-prone endpoints during ticket-sale spikes, but the change should remain scoped to request throttling and should not alter checkout, payment, QR, notification, or check-in logic.

## Goals / Non-Goals

**Goals:**

- Add a minimal backend throttling layer for the most sensitive endpoints.
- Enforce fixed-window limits for auth, order creation, and organizer mutation requests.
- Reuse the existing Redis integration so the feature remains low-risk and easy to deploy.
- Return consistent HTTP 429 responses with localized Vietnamese messaging.

**Non-Goals:**

- CAPTCHA, bot scoring, waiting rooms, or queue-based sale management.
- Changes to payment, QR, notification, or check-in code paths.
- Strict per-route throttling for public concert read endpoints in this task.

## Decisions

- Use a Redis-backed guard rather than introducing a new dependency or complex sliding-window algorithm. The existing Redis service already supports atomic counter increments with TTL, which fits the MVP requirement well.
- Apply throttling at the NestJS guard layer so it can be attached selectively to individual controllers or methods without changing business services.
- Prefer user-based keys when a valid authenticated user ID is present, and fall back to IP-based keys for anonymous requests. This keeps legitimate authenticated users from being blocked by shared IPs while still protecting public auth endpoints.
- Use fixed-window counters for the MVP. This is simpler to reason about and sufficient for the requested limits while keeping the implementation small and safe.
- Keep the throttling logic centralized in a reusable guard plus a small rate-limit service so other protected endpoints can be added later.

## Risks / Trade-offs

- [Fixed-window counters can allow bursts at the edge of a window] → Mitigation: choose conservative limits and document that this is an MVP protection layer rather than a full anti-bot platform.
- [Redis unavailability could let requests through] → Mitigation: fail open for the MVP and log throttling errors so normal browsing remains available.
- [Shared IPs may affect legitimate users] → Mitigation: use user-based keys for authenticated flows and keep anonymous limits conservative.

## Migration Plan

- Add the guard and supporting service in the backend without changing existing route signatures.
- Apply the guard to the targeted auth, order, and organizer controller methods.
- Verify the limits with local requests and confirm that 429 responses are returned with the expected message and retry-after metadata.

## Open Questions

- None. The requested limits and response behavior are sufficiently defined for implementation.
