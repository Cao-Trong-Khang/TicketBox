## 1. Setup

- [x] 1.1 Add organizer ticket-type controller and service files inside the existing `ConcertsModule` structure.
- [x] 1.2 Do not create a new Nest module for this task.
- [x] 1.3 Create DTOs for organizer ticket-type create and update requests.
- [x] 1.4 Create explicit response mapping for list/detail/status-change responses.
- [x] 1.5 Register the organizer ticket-type controller and service in the existing `ConcertsModule`.

## 2. Authorization and Ownership

- [x] 2.1 Protect organizer ticket-type endpoints with `@UseGuards(JwtAuthGuard)`.
- [x] 2.2 Reuse the existing organizer role lookup from the organizer concert flow.
- [x] 2.3 Do not assume role exists in JWT; check organizer role from database.
- [x] 2.4 If authenticated user is not an organizer, return `403 Forbidden`.
- [x] 2.5 Enforce ownership for the parent concert.
- [x] 2.6 If the concert does not exist or is not owned by the current organizer, return `404 NotFound`.
- [x] 2.7 If the ticket type does not exist or does not belong to the owned concert, return `404 NotFound`.

## 3. Organizer Ticket-Type Endpoints

- [x] 3.1 Implement `GET /organizer/concerts/:concertId/ticket-types`.
- [x] 3.2 Implement `POST /organizer/concerts/:concertId/ticket-types`.
- [x] 3.3 Implement `PATCH /organizer/concerts/:concertId/ticket-types/:ticketTypeId`.
- [x] 3.4 Implement `POST /organizer/concerts/:concertId/ticket-types/:ticketTypeId/activate`.
- [x] 3.5 Implement `POST /organizer/concerts/:concertId/ticket-types/:ticketTypeId/deactivate`.

## 4. Create Ticket Type

- [x] 4.1 Create ticket type under the owned concert.
- [x] 4.2 New ticket types must default to `INACTIVE`.
- [x] 4.3 Required fields:
  - `code`
  - `name`
  - `priceVnd`
  - `totalQuantity`
  - `perUserLimit`

- [x] 4.4 Optional fields:
  - `saleStartAt`
  - `saleEndAt`

- [x] 4.5 Validate `priceVnd >= 0`.
- [x] 4.6 Validate `totalQuantity > 0`.
- [x] 4.7 Validate `perUserLimit > 0`.
- [x] 4.8 Validate `perUserLimit <= totalQuantity`.
- [x] 4.9 If both `saleStartAt` and `saleEndAt` are present, validate `saleStartAt < saleEndAt`.
- [x] 4.10 Enforce ticket type `code` uniqueness within the same concert.
- [x] 4.11 Duplicate `code` in the same concert returns `409 Conflict`.
- [x] 4.12 Do not set or modify `reservedQuantity` or `soldQuantity` except through schema defaults.

## 5. List Ticket Types

- [x] 5.1 Return all ticket types for the owned concert.
- [x] 5.2 Sort by `priceVnd ASC`, then `code ASC`.
- [x] 5.3 Response must include:
  - `id`
  - `code`
  - `name`
  - `priceVnd`
  - `totalQuantity`
  - `reservedQuantity`
  - `soldQuantity`
  - `availableQuantity`
  - `perUserLimit`
  - `saleStartAt`
  - `saleEndAt`
  - `status`
  - `createdAt`
  - `updatedAt`

- [x] 5.4 Compute `availableQuantity` as `Math.max(0, totalQuantity - reservedQuantity - soldQuantity)`.

## 6. Update Ticket Type

- [x] 6.1 Allow updating only mutable fields:
  - `code`
  - `name`
  - `priceVnd`
  - `totalQuantity`
  - `perUserLimit`
  - `saleStartAt`
  - `saleEndAt`

- [x] 6.2 Do not allow PATCH to change:
  - `reservedQuantity`
  - `soldQuantity`
  - `concertId`
  - `status`

- [x] 6.3 Validate `priceVnd >= 0` when provided.
- [x] 6.4 Validate `totalQuantity > 0` when provided.
- [x] 6.5 Validate `perUserLimit > 0` when provided.
- [x] 6.6 PATCH validation must use merged existing + incoming values.
- [x] 6.7 Validate merged `perUserLimit <= totalQuantity`.
- [x] 6.8 If merged `saleStartAt` and `saleEndAt` are both present, validate `saleStartAt < saleEndAt`.
- [x] 6.9 If `totalQuantity` is updated, validate `newTotalQuantity >= reservedQuantity + soldQuantity`.
- [x] 6.10 If `newTotalQuantity < reservedQuantity + soldQuantity`, return `409 Conflict`.
- [x] 6.11 If `code` is updated, enforce uniqueness within the same concert.
- [x] 6.12 When checking duplicate code during PATCH, exclude the current ticket type id.
- [x] 6.13 Duplicate `code` in the same concert returns `409 Conflict`.

## 7. Activate and Deactivate Ticket Type

- [x] 7.1 Activate endpoint sets status to `ACTIVE`.
- [x] 7.2 Deactivate endpoint sets status to `INACTIVE`.
- [x] 7.3 PATCH must not change status.
- [x] 7.4 Activating an already `ACTIVE` ticket type returns `409 Conflict`.
- [x] 7.5 Deactivating an already `INACTIVE` ticket type returns `409 Conflict`.
- [x] 7.6 Do not hard-delete ticket types in this task.

## 8. Cache and Public Visibility

- [x] 8.1 After create/update/activate/deactivate, invalidate the existing public ticket-type cache key for the concert.
- [x] 8.2 Use the existing cache helper from `concerts.cache.ts` if available.
- [x] 8.3 The effective cache key is `concerts:{concertId}:ticket-types`.
- [x] 8.4 Do not create organizer-specific cache keys in this task.
- [x] 8.5 Keep Redis invalidation non-fatal so cache failures do not block organizer requests.
- [x] 8.6 Preserve the public API rule that only `ACTIVE` ticket types are returned to the public.
- [x] 8.7 After activate/deactivate, public `GET /concerts/:id/ticket-types` should reflect the latest active-only result after cache invalidation.

## 9. Error Handling

- [x] 9.1 Use `400 BadRequest` for input validation failures:
  - `priceVnd < 0`
  - `totalQuantity <= 0`
  - `perUserLimit <= 0`
  - `perUserLimit > totalQuantity`
  - invalid sale window

- [x] 9.2 Use `409 Conflict` for business-rule conflicts:
  - duplicate code in the same concert
  - reducing `totalQuantity` below `reservedQuantity + soldQuantity`
  - activating already `ACTIVE`
  - deactivating already `INACTIVE`

- [x] 9.3 Use `404 NotFound` for missing or foreign concerts/ticket types.
- [x] 9.4 Use `403 Forbidden` for authenticated users who are not organizers.

## 10. Out of Scope

- [x] 10.1 Do not implement ticket deletion.
- [x] 10.2 Do not implement seat maps.
- [x] 10.3 Do not implement VIP CSV import.
- [x] 10.4 Do not implement payment.
- [x] 10.5 Do not modify order logic.
- [x] 10.6 Do not implement QR tickets.
- [x] 10.7 Do not implement frontend work.
- [x] 10.8 Do not implement admin endpoints.

## 11. Verification

- [x] 11.1 Run backend build and lint checks if available.
- [x] 11.2 Run existing backend tests if available.
- [x] 11.3 Add or update backend tests if the existing test pattern is straightforward.
- [ ] 11.4 Manually verify organizer can create an `INACTIVE` ticket type.
- [ ] 11.5 Manually verify organizer can list ticket types for own concert.
- [ ] 11.6 Manually verify organizer cannot access another organizer's concert ticket types.
- [ ] 11.7 Manually verify audience/non-organizer gets `403`.
- [ ] 11.8 Manually verify duplicate code in same concert returns `409`.
- [ ] 11.9 Manually verify invalid quantities return `400`.
- [ ] 11.10 Manually verify reducing `totalQuantity` below `reservedQuantity + soldQuantity` returns `409`.
- [ ] 11.11 Manually verify activate/deactivate works.
- [ ] 11.12 Manually verify activating already `ACTIVE` returns `409`.
- [ ] 11.13 Manually verify deactivating already `INACTIVE` returns `409`.
- [ ] 11.14 Manually verify public `GET /concerts/:id/ticket-types` reflects only `ACTIVE` ticket types after cache invalidation.
