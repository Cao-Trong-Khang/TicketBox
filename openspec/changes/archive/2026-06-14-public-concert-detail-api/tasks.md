## 1. Module and Route Setup

- [x] 1.1 Add the `GET /concerts/:id` route to the existing `concerts.controller.ts`.
- [x] 1.2 Validate the route parameter with `ParseUUIDPipe` before calling the service.
- [x] 1.3 Add a public detail response DTO for the metadata plus `seatingSvg` shape.

## 2. Detail Lookup and Caching

- [x] 2.1 Implement `findPublishedConcertDetail(concertId: string)` in `concerts.service.ts`.
- [x] 2.2 Query PostgreSQL with Prisma for `ConcertStatus.PUBLISHED` only and throw `NotFoundException` when no published concert exists.
- [x] 2.3 Reuse the existing `RedisCacheService` with cache key `concerts:detail:{concertId}` and a 300-second TTL.
- [x] 2.4 Cache the mapped DTO response instead of the raw Prisma object.
- [x] 2.5 Treat invalid cached JSON as a cache miss and delete the corrupted cache key when `RedisCacheService.del` is available.
- [x] 2.6 Convert `Date` fields to ISO strings, include `seatingSvg`, and exclude internal fields such as `status`, `organizerId`, `ticketTypes`, `orders`, and `tickets`.
- [x] 2.7 Do not include ticket type or availability data in this endpoint; those will be handled by `GET /concerts/:id/ticket-types`.

## 3. Verification

- [x] 3.1 Run the narrowest applicable backend validation path and confirm the feature remains compatible with `npm run start:dev`.
