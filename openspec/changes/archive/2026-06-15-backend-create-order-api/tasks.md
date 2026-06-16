## 1. Module Setup

- [x] 1.1 Create `backend/src/modules/orders/` directory structure.
- [x] 1.2 Create `orders.module.ts` with `PrismaModule` and `RedisCacheModule` imports.
- [x] 1.3 Create `orders.controller.ts` with `@Controller('orders')`, `@UseGuards(JwtAuthGuard)`, and `@HttpCode(200)` for `POST /orders`.
- [x] 1.4 Create `orders.service.ts` with dependency injection for `PrismaService` and `RedisCacheService`.
- [x] 1.5 Add `OrdersModule` to `backend/src/app.module.ts` imports.

## 2. DTOs and Response Shape

- [x] 2.1 Create `orders/dto/create-order.request.dto.ts` with `concertId`, `items[]`, and `idempotencyKey`.
- [x] 2.2 Validate request DTO shape: `concertId` is UUID, `idempotencyKey` is UUID, `items` is a non-empty array, each item has `ticketTypeId` UUID and positive integer `quantity`.
- [x] 2.3 Create `orders/dto/create-order.response.dto.ts` with `orderId`, `orderCode`, `status`, `totalAmountVnd`, and `expiresAt`.
- [x] 2.4 Do not implement payment fields, checkout URL, ticket issuance data, or QR code data in this response.

## 3. Idempotency and Pre-Transaction Validation

- [x] 3.1 In `orders.service.createOrder()`, query existing order by `userId + idempotencyKey` before starting the transaction.
- [x] 3.2 If an existing order is found, return it immediately as `CreateOrderResponseDto`.
- [x] 3.3 Do not revalidate concert, ticket types, per-user limits, or reserve tickets on idempotent hit.
- [x] 3.4 Reject duplicate `ticketTypeId` values in the request items before starting the transaction with `BadRequestException`.
- [x] 3.5 Do not merge duplicate ticket type rows in MVP.

## 4. Transaction: Concert and Ticket Type Validation

- [x] 4.1 Begin a Prisma transaction with `prisma.$transaction()`.
- [x] 4.2 Query `Concert` by `concertId`; if not found, throw `NotFoundException`; if status is not `PUBLISHED`, throw `ConflictException`.
- [x] 4.3 Query all requested `TicketType` records by ids and `concertId`; if result count differs from request count, throw `NotFoundException`.
- [x] 4.4 Build `Map<ticketTypeId, ticketType>` from the fetched ticket types for reuse throughout the transaction.
- [x] 4.5 For each ticket type, validate status is `ACTIVE`; otherwise throw `ConflictException`.
- [x] 4.6 For each ticket type, validate sales window: `saleStartAt <= now` and `saleEndAt` is null or `saleEndAt >= now`; otherwise throw `ConflictException`.
- [x] 4.7 For each request item, validate `quantity` is a positive integer; otherwise throw `BadRequestException`.

## 5. Transaction: Per-User Limit Validation

- [x] 5.1 For each requested `ticketTypeId`, query existing `OrderItem` quantity for the same user and ticket type where order status is in active statuses: `PENDING` and `PAID`.
- [x] 5.2 Sum existing quantities from those active orders; treat null sum as 0.
- [x] 5.3 Validate `existingQty + requestedQty <= ticketType.perUserLimit`; otherwise throw `ConflictException`.
- [x] 5.4 Always perform the existing active quantity check; do not skip it just because the current request quantity is below `perUserLimit`.

## 6. Transaction: Atomic Ticket Reservation

- [x] 6.1 For each request item, reserve tickets with raw SQL conditional update on the verified table/column names from Prisma schema.
- [x] 6.2 The reservation query must atomically increment `reserved_quantity` only when enough inventory remains:

```sql
UPDATE ticket_types
SET reserved_quantity = reserved_quantity + <quantity>
WHERE id = <ticketTypeId>
  AND (total_quantity - reserved_quantity - sold_quantity) >= <quantity>
```

- [x] 6.3 Use Prisma `$executeRaw` with parameterized/template values; do not interpolate raw user input into SQL strings.
- [x] 6.4 If any reservation update affects 0 rows, throw `ConflictException("Not enough tickets available")`.
- [x] 6.5 Ensure any failed reservation rolls back the entire transaction, including all prior successful reservation increments in the same request.
- [x] 6.6 Do not trust frontend `availableQuantity` or Redis cached availability.

## 7. Transaction: Order and OrderItem Creation

- [x] 7.1 Calculate each order item subtotal and `totalAmountVnd` from request quantities and `priceVnd` from `ticketTypeMap` before creating the order.
- [x] 7.2 Generate `orderCode` using MVP format: `TBX` + timestamp + short random suffix.
- [x] 7.3 Create `Order` with `status=PENDING`, `expiresAt=now+15min`, `userId`, `concertId`, `orderCode`, `idempotencyKey`, and `totalAmountVnd`.
- [x] 7.4 After `Order` is created, create `OrderItem` records using the created `order.id`.
- [x] 7.5 Each `OrderItem` must use `ticketTypeId`, `quantity`, `unitPriceVnd` from `ticketTypeMap`, and calculated `subtotalVnd`.
- [x] 7.6 Do not create `OrderItem` before `Order` exists.
- [x] 7.7 Commit the transaction only after all reservations, order creation, and order item creation succeed.

## 8. Post-Transaction: Redis Cache Invalidation

- [x] 8.1 After transaction commit, call `redisCache.del("concerts:{concertId}:ticket-types")`.
- [x] 8.2 Use the existing `RedisCacheService.del()` method name from the project.
- [x] 8.3 If Redis deletion fails, do not roll back the order and do not fail the request; `RedisCacheService` should log/cache-handle the failure internally.
- [x] 8.4 Do not invalidate unrelated concert list/detail cache keys in this task.

## 9. Controller and Response

- [x] 9.1 In `orders.controller.ts`, implement `POST /orders` to call `ordersService.createOrder(req.user.id, dto)`.
- [x] 9.2 Use the existing `JwtAuthGuard`; unauthenticated requests should return 401.
- [x] 9.3 Use `@HttpCode(200)` and return `CreateOrderResponseDto` for both newly created orders and idempotent existing orders.
- [x] 9.4 Confirm existing JWT strategy populates `req.user.id` from JWT payload and follow the current project convention.
- [x] 9.5 Use built-in Nest exceptions: `BadRequestException`, `NotFoundException`, and `ConflictException`.

## 10. Verification

- [x] 10.1 Run backend typecheck/lint/build/test commands if available; developer will manually test API behavior.
