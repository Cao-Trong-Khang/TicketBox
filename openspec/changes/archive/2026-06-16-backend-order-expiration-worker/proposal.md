## Why

Orders that fail payment remain in PENDING status indefinitely, blocking inventory for up to 15 minutes. Without automatic expiration, users see unavailable tickets even though payment was never completed. A scheduled job that expires overdue PENDING orders and releases reserved tickets restores inventory visibility and prevents inventory locks from failed checkouts.

## What Changes

- Implement a scheduled background job that runs every 60 seconds
- Query all PENDING orders where `expiresAt <= now()`, up to 100 per run
- For each expired order, atomically transition status to EXPIRED and release reserved ticket quantities back to TicketType.reserved_quantity
- Invalidate Redis cache for affected concerts post-transaction
- Use conditional updates to prevent race conditions with payment webhooks
- Gracefully handle per-order failures without blocking subsequent orders

## Capabilities

### New Capabilities

- `order-expiration`: Background scheduled job that automatically expires overdue PENDING orders and releases reserved ticket inventory to restore availability

### Modified Capabilities

<!-- No existing capability requirements are changing; this is a new background job feature -->

## Impact

**Affected Code & Modules**

- Backend: `src/modules/orders/` (new OrderExpirationService)
- Backend: `src/app.module.ts` (import ScheduleModule.forRoot())
- Database: Uses existing Order and TicketType models; leverages existing @@index([status]) and @@index([expiresAt]) indexes

**Dependencies**

- Requires `@nestjs/schedule` package for @Cron decorator

**User Roles & Systems**

- Audience: Indirect benefit (tickets released back to public inventory when orders expire)
- Payment system: Interacts with Order status transitions; prevents race conditions with payment webhooks via conditional updates
- No external systems (VNPAY, Email, AI, Sponsor CSV)

**Database Changes**

- None required; uses existing schema and indexes
