## Why

The ticket quantity selection UI is now ready on the frontend, but the backend has no API to create pending orders and reserve tickets. This blocks end-to-end checkout workflow testing. The API must enforce per-user limits, validate availability under concurrent requests, and maintain transaction atomicity to prevent overselling.

## What Changes

- **New endpoint**: `POST /orders` (authenticated only)
- **New request body**: `concertId`, array of `items` (ticketTypeId + quantity), `idempotencyKey`
- **New response**: orderId, orderCode, PENDING status, totalAmountVnd, expiresAt
- **Idempotency protection**: Same userId + idempotencyKey returns existing order
- **Ticket reservation**: Atomic conditional update prevents overselling under concurrent requests
- **Per-user limits**: Enforced across PENDING and PAID orders for each ticket type
- **Redis cache invalidation**: Stale ticket availability removed after successful reservation
- **Orders module**: New NestJS module (controller, service, DTOs) added to backend

## Capabilities

### New Capabilities

- `create-order`: Authenticated users can submit pending orders with ticket type quantities, validate availability/limits, reserve tickets atomically, and receive orderCode + expiration time.

### Modified Capabilities

## Impact

- **Backend API**: New POST /orders endpoint in authenticated namespace
- **Database**: No schema changes; Order and OrderItem models already exist with idempotencyKey unique constraint
- **Code**: New `src/modules/orders/` module imported into AppModule
- **External systems**: None (payment not implemented yet)
- **User roles**: Audience users only (order creation)
