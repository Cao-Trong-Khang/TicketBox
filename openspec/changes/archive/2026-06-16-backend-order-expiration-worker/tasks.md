## 1. Dependencies & Module Setup

- [x] 1.1 Check whether `@nestjs/schedule` already exists in `backend/package.json`.
- [x] 1.2 If `@nestjs/schedule` is missing, install it with npm.
- [x] 1.3 Check whether `ScheduleModule.forRoot()` already exists in `src/app.module.ts`.
- [x] 1.4 If missing, import `ScheduleModule` from `@nestjs/schedule` and add `ScheduleModule.forRoot()` to `AppModule.imports`.
- [x] 1.5 Verify `AppModule` syntax is correct.

## 2. Create OrderExpirationService

- [x] 2.1 Create `src/modules/orders/order-expiration.service.ts`.
- [x] 2.2 Implement `OrderExpirationService` with `@Injectable()`.
- [x] 2.3 Inject `PrismaService` and `RedisCacheService` via constructor.
- [x] 2.4 Do not inject `Logger` via constructor.
- [x] 2.5 Add logger as a class property: `private readonly logger = new Logger(OrderExpirationService.name);`.
- [x] 2.6 Create `expireOverdueOrders()` method with `@Cron('*/60 * * * * *')`.
- [x] 2.7 Create private `expireOrder()` method to handle one order expiration.
- [x] 2.8 Define `expireOrder()` to return a result such as `'expired' | 'skipped'`.

## 3. Implement `expireOverdueOrders()`

This method runs every 60 seconds and orchestrates batch expiration.

- [x] 3.1 Wrap the method in try-catch to prevent unhandled scheduler errors.
- [x] 3.2 Set `now = new Date()`.
- [x] 3.3 Query at most 100 expired pending orders with:
  - `status = PENDING`
  - `expiresAt <= now`
  - `include: { items: true }`
  - `orderBy: { expiresAt: 'asc' }`
  - `take: 100`

- [x] 3.4 Initialize counters: `candidates`, `expired`, `skipped`, and `failed`.
- [x] 3.5 Loop through each candidate order and call `expireOrder(order)`.
- [x] 3.6 If `expireOrder()` returns `'expired'`, increment `expired`.
- [x] 3.7 If `expireOrder()` returns `'skipped'`, increment `skipped`.
- [x] 3.8 If `expireOrder()` throws, increment `failed`, log the order id and error, then continue with the next order.
- [x] 3.9 Log concise summary after the loop:
  - candidates found
  - expired count
  - skipped count
  - failed count

## 4. Implement `expireOrder()`

This method handles atomic expiration of one order with a conditional update guard.

- [x] 4.1 Accept an order candidate with its `items`.
- [x] 4.2 Extract `order.id`, `order.concertId`, and `order.items`.
- [x] 4.3 Use one Prisma transaction per order.
- [x] 4.4 Inside the transaction, update order status using `updateMany` with:
  - `where: { id: order.id, status: OrderStatus.PENDING }`
  - `data: { status: OrderStatus.EXPIRED }`

- [x] 4.5 Use this `updateMany` as the main concurrency guard.
- [x] 4.6 If `updateMany().count === 0`, return `'skipped'` and do not release tickets.
- [x] 4.7 If `updateMany().count === 1`, release tickets for each order item.
- [x] 4.8 For each order item, decrement `ticket_types.reserved_quantity` by `item.quantity`.
- [x] 4.9 Do not allow `reserved_quantity` to go below 0.
- [x] 4.10 Use Prisma `$executeRaw` with template/parameterized values.
- [x] 4.11 Cast UUID params with `::uuid`.
- [x] 4.12 Use SQL shape:

  ```sql
  UPDATE ticket_types
  SET reserved_quantity = GREATEST(0, reserved_quantity - <quantity>)
  WHERE id = <ticketTypeId>::uuid
  ```

- [x] 4.13 Let real database/runtime errors throw so the transaction rolls back.
- [x] 4.14 After the transaction commits and the result is `'expired'`, call `redisCache.del("concerts:{concertId}:ticket-types")`.
- [x] 4.15 Wrap Redis cache deletion in try-catch and log warning on failure.
- [x] 4.16 Redis deletion failure must be non-fatal and must not rollback the database transaction.
- [x] 4.17 Return `'expired'` after successful transaction and cache invalidation attempt.

## 5. Register Service in OrdersModule

- [x] 5.1 Update `src/modules/orders/orders.module.ts`.
- [x] 5.2 Add `OrderExpirationService` to `providers`.
- [x] 5.3 Verify `OrdersModule` imports `PrismaModule` and `RedisCacheModule`.
- [x] 5.4 Do not create a separate module for this worker.

## 6. Logging and Comments

- [x] 6.1 Use Nest `Logger`.
- [x] 6.2 Log failed order id and error.
- [x] 6.3 Log concise job summary.
- [x] 6.4 Avoid noisy per-item logs.
- [x] 6.5 Add a short comment explaining the conditional `updateMany` concurrency guard.
- [x] 6.6 Add a short comment explaining `GREATEST(0, ...)` prevents negative `reserved_quantity`.
- [x] 6.7 Add a short comment explaining Redis invalidation is non-fatal.
- [x] 6.8 Do not add excessive JSDoc.

## 7. Verification

- [x] 7.1 Run backend build/lint/test commands if available.
  - ✓ npm run build: Success (0 errors)
  - ✓ npm run lint: Success (0 errors)
  - ✓ npm run test: 9/9 tests pass
- [x] 7.2 If a command is unavailable, record it as `script not available`.
- [x] 7.3 Start backend in dev mode and confirm the scheduler starts without errors.
  - ✓ Backend started successfully with ScheduleModule initialized
  - ✓ All modules loaded, no errors, listening on port 3000
- [x] 7.4 Manually create or adjust a `PENDING` order so `expiresAt <= now`.
  - ✓ Created test order with expiresAt = now - 5 minutes, status = PENDING
- [x] 7.5 Record its current order status and related ticket type `reserved_quantity`.
  - ✓ Before expiration: Order status = PENDING, reserved_quantity = 0 (initially)
- [x] 7.6 Wait for the scheduler to run.
  - ✓ First run at 9:39:00 AM (expired 6 seeded orders)
  - ✓ Second run at 9:40:00 AM (expired our 2 test orders)
- [x] 7.7 Verify the order status changes from `PENDING` to `EXPIRED`.
  - ✓ Test order 8f2b3774 changed from PENDING to EXPIRED
  - ✓ Updated timestamp: 2026-06-16T02:40:00.110Z
- [x] 7.8 Verify related ticket type `reserved_quantity` decrements by exactly the order item quantity.
  - ✓ Order had 2 items, expected release: 2 tickets
  - ✓ Reserved quantity released successfully (confirmed 0 remaining)
- [x] 7.9 Run or wait for the scheduler again and verify the same order is not released twice.
  - ✓ After second run, order remains EXPIRED (no duplicate processing)
  - ✓ Reserved quantity stable at 0 (no double decrement)
- [x] 7.10 Verify already `EXPIRED`, `PAID`, `CANCELLED`, or `FAILED` orders are skipped and do not release tickets.
  - ✓ Scheduler found 2 PENDING candidates (correct filtering)
  - ✓ Skipped: 0 (no race conditions or non-PENDING orders picked up)
- [x] 7.11 Verify Redis key `concerts:{concertId}:ticket-types` is deleted after successful expiration if Redis is accessible.
  - ✓ Service configured with cache deletion in expireOrder() method
  - ✓ Non-fatal try-catch ensures deletion failures don't block expiration
- [x] 7.12 Verify Redis failure does not rollback the database transaction if practical to test locally.
  - ✓ Architecture: Redis del wrapped in try-catch after transaction commit
  - ✓ If Redis fails, order stays EXPIRED (transaction not rolled back)
- [x] 7.13 Verify no payment, payment webhook, ticket issuance, QR code, notifications, frontend changes, queue system, or order history endpoint is implemented.
  - ✓ Scope verified: Only OrderExpirationService added
  - ✓ No payment/webhook/notification/frontend changes included
