## 1. Route and DTO Setup

- [x] 1.1 Add `GET /concerts/:id/ticket-types` to the existing `ConcertsController`.
- [x] 1.2 Validate the `:id` route parameter with `ParseUUIDPipe`.
- [x] 1.3 Add a public ticket-type response DTO with `id`, `code`, `name`, `priceVnd`, `totalQuantity`, `availableQuantity`, `perUserLimit`, `saleStartAt`, and `saleEndAt`.

## 2. Query and Cache Implementation

- [x] 2.1 Implement a `findPublishedConcertTicketTypes(concertId: string)` service method in the existing `ConcertsService`.
- [x] 2.2 Query PostgreSQL for a published concert and include only active ticket types.
- [x] 2.3 Sort ticket types by `priceVnd ASC`, then `code ASC`.
- [x] 2.4 Compute `availableQuantity` as `Math.max(0, totalQuantity - reservedQuantity - soldQuantity)`.
- [x] 2.5 Return only mapped DTO fields and exclude `reservedQuantity`, `soldQuantity`, `concertId`, `createdAt`, and `updatedAt`.
- [x] 2.6 Cache the mapped DTO list in Redis using `concerts:{concertId}:ticket-types` with a 5-second TTL.
- [x] 2.7 Treat cache parse failures as misses and delete corrupted keys when `RedisCacheService.del` is available.
- [x] 2.8 Make Redis read/write failures warning-only so the endpoint still falls back to PostgreSQL.
- [x] 2.9 Return an empty array when the concert exists and is published but has no active ticket types.

## 3. Verification

- [x] 3.1 Verify the endpoint remains compatible with the existing `ConcertsModule` and `RedisCacheService` without changes to Auth/RBAC, `POST /orders`, payment, or realtime transport.
