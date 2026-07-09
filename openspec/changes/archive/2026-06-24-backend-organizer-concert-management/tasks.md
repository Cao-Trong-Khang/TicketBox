## 1. Setup

- [x] 1.1 Create `OrganizerConcertsController` inside `backend/src/modules/concerts`.
- [x] 1.2 Create `OrganizerConcertsService` inside `backend/src/modules/concerts`.
- [x] 1.3 Use controller path `@Controller('organizer/concerts')`.
- [x] 1.4 Add DTO classes for organizer concert create, update, list response, and detail response.
- [x] 1.5 Update `ConcertsModule` to register the organizer controller and service.
- [x] 1.6 Keep existing public `ConcertsController` and `ConcertsService` behavior unchanged.

## 2. Authorization and Ownership

- [x] 2.1 Protect `OrganizerConcertsController` with `@UseGuards(JwtAuthGuard)`.
- [x] 2.2 Use existing authenticated request shape `{ id, email }`.
- [x] 2.3 Do not assume JWT contains role.
- [x] 2.4 Implement database role check using `ROLE_CODES.organizer` inside `OrganizerConcertsService`.
- [x] 2.5 If authenticated user is not an organizer, return `403 Forbidden`.
- [x] 2.6 Enforce `concert.organizerId === request.user.id` ownership for detail, update, and publish actions.
- [x] 2.7 If concert does not exist or is not owned by current organizer, return `404 NotFound`.
- [x] 2.8 Do not return `403` for not-owned concerts.

## 3. DTOs and Response Shapes

- [x] 3.1 Create DTO requires:
  - `title`
  - `artistName`
  - `venueName`
  - `venueAddress`
  - `startsAt`
  - `endsAt`

- [x] 3.2 Create DTO allows optional:
  - `description`
  - `bannerUrl`
  - `seatingSvg`

- [x] 3.3 Update DTO allows editing:
  - `title`
  - `artistName`
  - `description`
  - `venueName`
  - `venueAddress`
  - `bannerUrl`
  - `seatingSvg`
  - `startsAt`
  - `endsAt`

- [x] 3.4 Update DTO must not allow changing `status` or `organizerId`.
- [x] 3.5 List response DTO includes:
  - `id`
  - `status`
  - `title`
  - `artistName`
  - `venueName`
  - `startsAt`
  - `endsAt`
  - `createdAt`
  - `updatedAt`

- [x] 3.6 Detail response DTO includes:
  - `id`
  - `status`
  - `title`
  - `artistName`
  - `description`
  - `venueName`
  - `venueAddress`
  - `bannerUrl`
  - `seatingSvg`
  - `startsAt`
  - `endsAt`
  - `createdAt`
  - `updatedAt`

- [x] 3.7 Use explicit response mapping and do not leak unnecessary internal fields.

## 4. Organizer Concert Operations

- [x] 4.1 Implement `GET /organizer/concerts` to return only the current organizer's concerts ordered by `createdAt DESC`.
- [x] 4.2 Implement `POST /organizer/concerts` to create a concert with `organizerId = request.user.id`.
- [x] 4.3 New organizer-created concerts must default to `DRAFT`.
- [x] 4.4 Validate `startsAt < endsAt` on create.
- [x] 4.5 Do not create ticket types in `POST /organizer/concerts`.
- [x] 4.6 Implement `GET /organizer/concerts/:id` to return owned concert detail or `404 NotFound`.
- [x] 4.7 Implement `PATCH /organizer/concerts/:id` to update only owned `DRAFT` concerts.
- [x] 4.8 If updating a `PUBLISHED` concert, return `409 Conflict`.
- [x] 4.9 Validate `startsAt < endsAt` on update when relevant.
- [x] 4.10 Implement `POST /organizer/concerts/:id/publish`.
- [x] 4.11 If already `PUBLISHED`, return `409 Conflict`.
- [x] 4.12 Publish readiness validation must require:
  - `title`
  - `artistName`
  - `venueName`
  - `venueAddress`
  - `startsAt`
  - `endsAt`
  - `startsAt < endsAt`
  - `startsAt` is in the future

- [x] 4.13 If publish readiness validation fails, return `400 BadRequest`.
- [x] 4.14 If publish succeeds, set status to `PUBLISHED`.

## 5. Cache and Redis

- [x] 5.1 Invalidate public cache keys only after successful publish:
  - `concerts:list:published`
  - `concerts:detail:{id}`

- [x] 5.2 Use existing `RedisCacheService.del()`.
- [x] 5.3 Ensure Redis failure during cache invalidation does not block the publish response.
- [x] 5.4 Do not invalidate public concert cache for draft create/update.

## 6. Validation and Error Handling

- [x] 6.1 Use explicit NestJS exceptions:
  - `ForbiddenException`
  - `NotFoundException`
  - `ConflictException`
  - `BadRequestException`

- [x] 6.2 Use class-validator DTO validation where appropriate.
- [x] 6.3 Validate date strings can be parsed into valid dates.
- [x] 6.4 Validate `startsAt < endsAt` on create and update.
- [x] 6.5 Prevent changing `status` or `organizerId` through the update endpoint.
- [x] 6.6 Keep ticket type management, image upload, payment, orders, tickets, QR, frontend work, and admin endpoints out of scope.

## 7. Verification

- [x] 7.1 Run backend build and lint checks if available.
- [x] 7.2 Run existing backend tests if available.
- [x] 7.3 Add/update tests for organizer endpoints if the project has a straightforward existing pattern.
- [x] 7.4 Manually verify organizer can create a draft concert.
- [x] 7.5 Manually verify organizer can list only own concerts.
- [x] 7.6 Manually verify organizer can get own concert detail.
- [x] 7.7 Manually verify organizer gets `404` for another organizer's concert.
- [x] 7.8 Manually verify audience/non-organizer gets `403` for organizer endpoints.
- [x] 7.9 Manually verify organizer can update `DRAFT` concert.
- [x] 7.10 Manually verify organizer gets `409` when updating `PUBLISHED` concert.
- [x] 7.11 Manually verify organizer can publish valid `DRAFT` concert.
- [x] 7.12 Manually verify invalid publish attempt returns `400`.
- [x] 7.13 Manually verify public `GET /concerts` includes newly published concert.
