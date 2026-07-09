## 1. Feature Setup

- [x] 1.1 Create the public concerts module, controller, service, and response DTO/type under `src/modules/concerts/`.
- [x] 1.2 Register `ConcertsModule` in `AppModule` so `GET /concerts` is available at runtime.
- [x] 1.3 Add a lightweight `RedisCacheModule` and `RedisCacheService` using `ioredis`, instead of a generic `CacheModule`/`CacheService` name.
- [x] 1.4 Wire `RedisCacheService` to read `REDIS_URL` from environment configuration, defaulting to `redis://localhost:6379` for local development if needed.
- [x] 1.5 Add the `ioredis` dependency.
- [x] 1.6 Document `REDIS_URL=redis://localhost:6379` in local environment documentation or `.env.example` if the project has one.

## 2. Public Concert List Implementation

- [x] 2.1 Implement `GET /concerts` as a public controller endpoint with no auth requirement in the current codebase.
- [x] 2.2 Query PostgreSQL through Prisma for concerts with `ConcertStatus.PUBLISHED` and `startsAt >= now`, ordered by `startsAt ASC`.
- [x] 2.3 Use Prisma enums `ConcertStatus.PUBLISHED` and `TicketTypeStatus.ACTIVE` instead of hard-coded status strings.
- [x] 2.4 Include only active ticket types in the Prisma query.
- [x] 2.5 Compute `minPriceVnd` from the lowest active ticket type price.
- [x] 2.6 Return `minPriceVnd: null` when a concert has no active ticket types.
- [x] 2.7 Map Prisma results to a public concert list DTO before returning or caching.
- [x] 2.8 Convert `Date` fields to ISO strings in the response.
- [x] 2.9 Exclude `seatingSvg`, `organizerId`, `ticketTypes`, `orders`, `tickets`, and other internal fields from the response.
- [x] 2.10 Cache the mapped DTO list, not raw Prisma results, in Redis with key `concerts:list:published` and a 60-second TTL.
- [x] 2.11 Implement cache-aside flow: read Redis first, return cached DTO list on hit, query PostgreSQL on miss, then set Redis.
- [x] 2.12 Make Redis `get`/`set`/`del` failures warning-only so `GET /concerts` falls back to PostgreSQL without failing the request.
- [x] 2.13 Ensure Redis unavailability does not crash the application during startup or request handling.

## 3. Verification

- [x] 3.3 Developer manually verifies app boot with `npm run start:dev`.
- [x] 3.4 Developer manually verifies `GET /concerts` returns seeded concerts, public fields only, sorted by `startsAt ASC`.
- [x] 3.5 Developer manually verifies Redis key `concerts:list:published` exists and has TTL <= 60 when Redis is running.
