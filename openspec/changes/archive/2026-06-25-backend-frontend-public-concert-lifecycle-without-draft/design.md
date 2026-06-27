# Design: Backend/Frontend — Public Concert Lifecycle Without Draft

## Overview

This change keeps the existing Prisma schema and enum values intact. The backend will continue storing concerts with the existing `ConcertStatus` values and will derive a lifecycle status for organizer-facing responses without introducing a schema migration.

## Backend design

### Status model

- Keep the existing Prisma enum values:
  - `DRAFT`
  - `PUBLISHED`
  - `CANCELLED`
  - `FINISHED`
- Do not rename `CANCELLED` to `CANCELED`.
- Use stored status `PUBLISHED` to indicate a concert is public.
- Use stored status `CANCELLED` to indicate a canceled concert.
- Stop using `DRAFT` in organizer create flow.

### Derived lifecycle status

Add a backend-derived `lifecycleStatus` field to organizer list/detail responses:

- `UPCOMING` when `now < startsAt`
- `ONGOING` when `startsAt <= now <= endsAt`
- `ENDED` when `now > endsAt`

Frontend will map this to Vietnamese labels. If the stored status is `CANCELLED`, the UI should display `Đã hủy` and treat it as higher priority than lifecycle status.

### Create flow

- Organizer concert creation will persist the new concert with stored status `PUBLISHED` immediately.
- No separate publish step is needed in the frontend.
- After creation, invalidate the public list/detail/ticket-type caches as needed.

### Edit rules

Allow editing only when:
- stored status is not `CANCELLED`
- derived lifecycle status is `UPCOMING`

Otherwise return `409 Conflict` with a clear message.

### Cancel flow

Add organizer endpoint:
- `POST /organizer/concerts/:id/cancel`

Allow cancel only when:
- stored status is not `CANCELLED`
- derived lifecycle status is `UPCOMING`

On success, set stored status to `CANCELLED`.

No refund/payment behavior is included in this task.

### Public APIs

Keep existing public visibility behavior aligned to current product rules:
- `GET /concerts` returns published upcoming concerts only.
- `GET /concerts/:id` returns a public concert only when stored status is `PUBLISHED`.
- `GET /concerts/:id/ticket-types` returns ticket types only when the concert is `PUBLISHED` and the ticket types are `ACTIVE`.
- Canceled concerts remain hidden from public endpoints because their stored status is `CANCELLED`.

### Cache invalidation

Use existing cache helpers:
- `PUBLIC_CONCERTS_CACHE_KEY`
- `getPublicConcertDetailCacheKey(concertId)`
- `getPublicTicketTypesCacheKey(concertId)`

Invalidate public list/detail/ticket-type caches after create, update, and cancel operations where relevant.

## Frontend design

### Create page

- Remove draft/publish messaging and any publish button from the create experience.
- Show success messaging that the concert was created and made public.
- Preserve the existing ticket-setup flow during creation.

### Edit page

- Remove the publish button.
- Use the backend-derived lifecycle status to determine editability.
- Disable submit and show:
  - `Concert đang diễn ra hoặc đã kết thúc nên không thể chỉnh sửa.` for `ONGOING` or `ENDED`
  - `Concert đã hủy nên không thể chỉnh sửa.` for canceled concerts
- Handle `409 Conflict` from the backend gracefully.

### Dashboard

- Display organizer lifecycle/status labels using the backend response:
  - `Sắp diễn ra`
  - `Đang diễn ra`
  - `Đã kết thúc`
  - `Đã hủy`
- Enable `Sửa` only for upcoming, non-canceled concerts.
- Enable `Hủy` only for upcoming, non-canceled concerts.
- Keep `Quản lý vé` available for MVP.

## Implementation boundaries

This change does not modify:
- payment
- notifications
- QR/e-ticket flow
- check-in
- refunds
- ticket-type lifecycle restrictions
