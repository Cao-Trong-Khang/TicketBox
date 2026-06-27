# Tasks: Backend/Frontend — Public Concert Lifecycle Without Draft

## 1. Backend — Concert Creation and Lifecycle Status

- [x] 1.1 Keep the existing Prisma `ConcertStatus` enum unchanged:
  - `DRAFT`
  - `PUBLISHED`
  - `CANCELLED`
  - `FINISHED`

- [x] 1.2 Do not add a Prisma migration in this task.
- [x] 1.3 Update organizer concert creation so newly created concerts are stored as `PUBLISHED` immediately.
- [x] 1.4 Do not create new organizer concerts as `DRAFT`.
- [x] 1.5 Add backend-derived `lifecycleStatus` to organizer concert list responses.
- [x] 1.6 Add backend-derived `lifecycleStatus` to organizer concert detail responses.
- [x] 1.7 Derive `lifecycleStatus` as:
  - `UPCOMING` when `now < startsAt`
  - `ONGOING` when `startsAt <= now <= endsAt`
  - `ENDED` when `now > endsAt`

- [x] 1.8 Keep stored status separate from derived lifecycle status.
- [x] 1.9 For `CANCELLED` concerts, frontend should prioritize stored status display over lifecycle status.

## 2. Backend — Edit Rules

- [x] 2.1 Update organizer concert update logic to allow edits only when:
  - stored status is not `CANCELLED`
  - `lifecycleStatus` is `UPCOMING`

- [x] 2.2 Reject edits for `ONGOING` concerts with `409 Conflict`.
- [x] 2.3 Reject edits for `ENDED` concerts with `409 Conflict`.
- [x] 2.4 Reject edits for `CANCELLED` concerts with `409 Conflict`.
- [x] 2.5 Use a clear backend message for rejected edits, for example:
      `Concert đang diễn ra hoặc đã kết thúc nên không thể chỉnh sửa.`
- [x] 2.6 Keep organizer role and ownership checks unchanged.
- [x] 2.7 Keep ticket setup behavior from the current create flow unchanged.

## 3. Backend — Cancel Endpoint

- [x] 3.1 Add organizer cancel endpoint:
      `POST /organizer/concerts/:id/cancel`
- [x] 3.2 Cancel endpoint must require existing organizer auth/role checks.
- [x] 3.3 Cancel endpoint must only allow cancel when:
  - stored status is not `CANCELLED`
  - `lifecycleStatus` is `UPCOMING`

- [x] 3.4 Cancel endpoint should set stored status to `CANCELLED`.
- [x] 3.5 Reject cancel for `ONGOING`, `ENDED`, and `CANCELLED` concerts with `409 Conflict`.
- [x] 3.6 Do not implement refund behavior.
- [x] 3.7 Do not touch payment, notification, QR, or check-in code.

## 4. Backend — Public APIs and Cache

- [x] 4.1 Keep `GET /concerts` showing public upcoming concerts only:
  - `status = PUBLISHED`
  - `startsAt >= now`

- [x] 4.2 Keep `GET /concerts/:id` public only for `status = PUBLISHED`.
- [x] 4.3 Keep `GET /concerts/:id/ticket-types` requiring:
  - concert `status = PUBLISHED`
  - ticket type `status = ACTIVE`

- [x] 4.4 Ensure `CANCELLED` concerts are hidden from public endpoints.
- [x] 4.5 Invalidate public concert list cache after create.
- [x] 4.6 Invalidate public concert list/detail/ticket-type caches after update.
- [x] 4.7 Invalidate public concert list/detail/ticket-type caches after cancel.
- [x] 4.8 Use existing cache helpers:
  - `PUBLIC_CONCERTS_CACHE_KEY`
  - `getPublicConcertDetailCacheKey(concertId)`
  - `getPublicTicketTypesCacheKey(concertId)`

- [x] 4.9 Keep Redis cache invalidation failures non-fatal if that is the current project pattern.

## 5. Frontend — Remove Publish Flow

- [x] 5.1 Remove or hide publish button from organizer create/edit flows.
- [x] 5.2 Stop calling the publish API from frontend.
- [x] 5.3 Remove draft/publish wording from organizer create/edit UI where practical.
- [x] 5.4 Update create flow success handling to treat newly created concerts as public immediately.
- [x] 5.5 After create success, show a message indicating the concert was created and made public.
- [x] 5.6 Do not expose `DRAFT`/`PUBLISHED` labels to public users.

## 6. Frontend — Lifecycle Display and Action Gating

- [x] 6.1 Update frontend organizer types to include `lifecycleStatus`.
- [x] 6.2 Display organizer dashboard status labels:
  - `UPCOMING` -> `Sắp diễn ra`
  - `ONGOING` -> `Đang diễn ra`
  - `ENDED` -> `Đã kết thúc`
  - stored `CANCELLED` -> `Đã hủy`

- [x] 6.3 Prioritize stored `CANCELLED` display over lifecycle status.
- [x] 6.4 Enable `Sửa` only for `UPCOMING` concerts that are not `CANCELLED`.
- [x] 6.5 Enable `Hủy` only for `UPCOMING` concerts that are not `CANCELLED`.
- [x] 6.6 Disable or hide edit/cancel actions for `ONGOING`, `ENDED`, and `CANCELLED` concerts.
- [x] 6.7 Keep `Quản lý vé` available for MVP.

## 7. Frontend — Edit and Cancel UX

- [x] 7.1 Update organizer edit page to allow editing only for `UPCOMING` concerts that are not `CANCELLED`.
- [x] 7.2 If concert is `ONGOING` or `ENDED`, disable edit submit and show:
      `Concert đang diễn ra hoặc đã kết thúc nên không thể chỉnh sửa.`
- [x] 7.3 If concert is `CANCELLED`, disable edit submit and show:
      `Concert đã hủy nên không thể chỉnh sửa.`
- [x] 7.4 Add dashboard cancel action for allowed concerts.
- [x] 7.5 On cancel success, update local dashboard state or refetch list.
- [x] 7.6 Handle backend `409` from edit/cancel gracefully.
- [x] 7.7 Handle `401`, `403`, and `404` with existing organizer-friendly error patterns.

## 8. Scope Boundaries

- [x] 8.1 Do not add Prisma migration.
- [x] 8.2 Do not change payment code.
- [x] 8.3 Do not change notification code.
- [x] 8.4 Do not change e-ticket QR code.
- [x] 8.5 Do not change check-in code.
- [x] 8.6 Do not add ticket type lifecycle restrictions in this task.
- [x] 8.7 Do not implement refunds.

## 9. Verification

- [x] 9.1 Run backend build/lint/test commands if available.
- [x] 9.2 Run frontend build/lint/test commands if available.
- [x] 9.3 Create a concert and confirm it is stored as `PUBLISHED` immediately.
- [x] 9.4 Confirm no publish button appears in organizer create/edit flow.
- [x] 9.5 Confirm organizer dashboard displays `Sắp diễn ra` for future concerts.
- [x] 9.6 Confirm organizer dashboard displays `Đang diễn ra` for concerts where `startsAt <= now <= endsAt`.
- [x] 9.7 Confirm organizer dashboard displays `Đã kết thúc` for concerts where `now > endsAt`.
- [x] 9.8 Confirm organizer dashboard displays `Đã hủy` for `CANCELLED` concerts.
- [x] 9.9 Confirm UPCOMING concerts can be edited.
- [x] 9.10 Confirm ONGOING concerts cannot be edited.
- [x] 9.11 Confirm ENDED concerts cannot be edited.
- [x] 9.12 Confirm CANCELLED concerts cannot be edited.
- [x] 9.13 Confirm UPCOMING concerts can be canceled.
- [x] 9.14 Confirm ONGOING, ENDED, and CANCELLED concerts cannot be canceled.
- [x] 9.15 Confirm public list/detail can see newly created `PUBLISHED` upcoming concerts.
- [x] 9.16 Confirm canceled concerts do not appear publicly.
- [x] 9.17 Confirm ticket types remain visible publicly only when concert is `PUBLISHED` and ticket type is `ACTIVE`.
- [x] 9.18 Confirm no payment, notification, QR, or check-in code was changed.
