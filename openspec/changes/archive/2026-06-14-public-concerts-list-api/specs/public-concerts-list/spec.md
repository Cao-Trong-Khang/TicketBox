## Specification: Public Concerts List

## Description

Audience users SHALL be able to request a public list of upcoming published concerts through `GET /concerts`. The endpoint SHALL return only concerts that are published and have a start time in the future. The response SHALL be optimized for public browsing and SHALL include the minimum active ticket price per concert when available.

## Main Flow

1. The Web Application calls the Backend API with `GET /concerts`.
2. The Backend API checks Redis for the cached mapped list response.
3. If the cache contains data, the Backend API returns the cached response immediately.
4. If the cache is missing or unavailable, the Backend API queries PostgreSQL through Prisma for published concerts whose start time is greater than or equal to the current time.
5. The Backend API loads active ticket types for each matching concert and computes the lowest active ticket price per concert.
6. The Backend API maps the database result to the public response shape and stores the mapped DTO list in Redis with a short TTL.
7. The Backend API returns the public concert list to the Web Application.

## Failure Scenarios

- If Redis is unavailable or returns an error, the Backend API SHALL log a warning and continue with the PostgreSQL query path.
- If no published upcoming concerts exist, the Backend API SHALL return an empty list.
- If a concert has no active ticket types, the Backend API SHALL return `minPriceVnd` as `null` for that concert.
- If PostgreSQL returns an error, the request SHALL fail normally because PostgreSQL is the source of truth.
- If cache contents are stale, the Backend API SHALL still return a structurally valid public list response.

## Constraints

- The endpoint SHALL be public in the current codebase and SHALL not require authentication for the request to succeed.
- The endpoint SHALL expose only published concerts whose `startsAt` value is greater than or equal to the current time.
- The endpoint SHALL sort results by `startsAt` ascending.
- The endpoint SHALL return only the public list fields and SHALL not expose `seatingSvg`.
- The endpoint SHALL use PostgreSQL as the source of truth and Redis only as a cache-aside optimization layer.
- The endpoint SHALL compute `minPriceVnd` from active ticket types only.
- The cache SHALL store the mapped DTO response rather than the raw Prisma payload.

## Acceptance Criteria

- GIVEN at least one published future concert exists, WHEN a client requests `GET /concerts`, THEN the response includes only published future concerts ordered by `startsAt` ascending.
- GIVEN a concert has multiple active ticket types, WHEN the list is returned, THEN `minPriceVnd` equals the lowest `priceVnd` among active ticket types.
- GIVEN a concert has no active ticket types, WHEN the list is returned, THEN `minPriceVnd` is `null`.
- GIVEN Redis is unavailable, WHEN the endpoint is requested, THEN the API still returns the PostgreSQL-backed response successfully.
- GIVEN the response is cached, WHEN the same endpoint is requested again within the TTL, THEN the API MAY serve the cached mapped DTO response.
