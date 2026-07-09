## 1. Prisma and database migration

- [x] 1.1 Add a nullable Prisma field `performanceStartAt DateTime?` to the concert model.
- [x] 1.2 Create the Prisma migration for the new concert field.
- [x] 1.3 Backfill existing records with `performanceStartAt = startsAt` for concerts that do not already have a value.
- [x] 1.4 Preserve the existing concert fields without renaming or removing `startsAt` or `endsAt`.
- [x] 1.5 Preserve the existing ticket-type fields without removing `TicketType.saleStartAt` or `TicketType.saleEndAt`.

## 2. Backend semantics and validation

- [x] 2.1 Update organizer concert create DTOs so `performanceStartAt` is required at the DTO/service level for new concerts.
- [x] 2.2 Update organizer concert update DTOs so `performanceStartAt` is optional and validated by merging incoming values with persisted concert values.
- [x] 2.3 Implement concert validation so `startsAt < endsAt` is required for new and updated concerts.
- [x] 2.4 Implement concert validation so `endsAt < performanceStartAt` is required for new and updated concerts.
- [x] 2.5 Update organizer concert service logic to apply the new validation rules during create and update flows.
- [x] 2.6 Update organizer concert list/detail DTOs so the existing start/end fields are treated as the concert-level ticket sale window and the new field represents actual performance time.
- [x] 2.7 Update public concert list/detail DTOs so the audience-facing contract uses `performanceStartAt` as the primary concert time.
- [x] 2.8 Update lifecycle/status computation so `UPCOMING`, `ONGOING`, and `ENDED` reflect ticket-sale availability based on the concert sale window, while preserving override states such as `CANCELLED` and `FINISHED`.
- [x] 2.9 Update order purchase validation to use the concert-level sale window (`startsAt`/`endsAt`) instead of relying on ticket-type sale timing for new logic.
- [x] 2.10 Deprecate ticket-type sale-window usage in new logic without removing the schema fields, so legacy compatibility remains intact.

## 3. Frontend organizer experience

- [x] 3.1 Update organizer concert form values, types, and helpers to carry `performanceStartAt` alongside the existing sale-window fields.
- [x] 3.2 Update the organizer create/edit concert form labels so the existing start field reads `Bắt đầu mở bán vé` and the existing end field reads `Kết thúc mở bán vé`.
- [x] 3.3 Add a new organizer concert form field labeled `Thời gian bắt đầu concert` for `performanceStartAt`.
- [x] 3.4 Ensure the organizer ticket-type form does not expose `saleStartAt` or `saleEndAt` fields.
- [x] 3.5 Ensure any organizer ticket-type form payloads no longer rely on sale-window fields for this flow.

## 4. Frontend public experience

- [x] 4.1 Update public concert list and concert cards to use `performanceStartAt` as the primary concert time.
- [x] 4.2 Update public concert detail pages to use `performanceStartAt` as the primary concert time.
- [x] 4.3 Update the ticket-type card so it no longer displays a per-ticket sale window.
- [x] 4.4 If any sale-window text is shown publicly, label it explicitly as the concert-level ticket sale window.

## 5. Tests and verification

- [x] 5.1 Run Prisma generate and apply the migration locally.
- [x] 5.2 Run backend build and relevant backend tests.
- [x] 5.3 Run frontend build and relevant frontend tests.
- [x] 5.4 Verify creating a concert with valid timing succeeds.
- [x] 5.5 Verify a concert is rejected when the sale end is after the performance start.
- [x] 5.6 Verify orders are rejected before the concert sale start.
- [x] 5.7 Verify orders are rejected after the concert sale end.
- [x] 5.8 Verify orders are allowed during the concert sale window.
- [x] 5.9 Verify audience display uses `performanceStartAt` as the primary event time.
- [x] 5.10 Verify organizer form labels are clear and match the new semantics.
