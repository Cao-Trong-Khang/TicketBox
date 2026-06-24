## 1. Frontend Routing and Dashboard Navigation

- [x] 1.1 Add the organizer ticket-type route at `/organizer/concerts/:concertId/ticket-types`.
- [x] 1.2 Replace the dashboard `Quản lý vé` placeholder action with a navigation link to the new route.
- [x] 1.3 `Quản lý vé` should no longer be marked as `Sắp ra mắt` after this task.

## 2. Organizer Ticket-Type API Layer

- [x] 2.1 Add organizer ticket-type API helpers:
  - `getOrganizerTicketTypes`
  - `createOrganizerTicketType`
  - `updateOrganizerTicketType`
  - `activateOrganizerTicketType`
  - `deactivateOrganizerTicketType`

- [x] 2.2 Use the existing `apiFetch` pattern.
- [x] 2.3 Do not hard-code backend URL.
- [x] 2.4 Add shared TypeScript types for:
  - organizer ticket-type records
  - create ticket-type request payload
  - update ticket-type request payload
  - ticket-type status values if useful

## 3. Ticket-Type Management Page

- [x] 3.1 Create the ticket-type management page and load ticket types for the selected `concertId`.
- [x] 3.2 Show loading, error, empty, and list states.
- [x] 3.3 Display these ticket-type fields:
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

- [x] 3.4 Format `priceVnd` as VND.
- [x] 3.5 Format `saleStartAt` and `saleEndAt` in `vi-VN` with timezone `Asia/Ho_Chi_Minh`.

## 4. Create and Edit Experience

- [x] 4.1 Add a create form for required and optional ticket-type fields.
- [x] 4.2 Required fields:
  - `code`
  - `name`
  - `priceVnd`
  - `totalQuantity`
  - `perUserLimit`

- [x] 4.3 Optional fields:
  - `saleStartAt`
  - `saleEndAt`

- [x] 4.4 New ticket types are created as `INACTIVE` by backend behavior.
- [x] 4.5 Add edit support for editable fields only:
  - `code`
  - `name`
  - `priceVnd`
  - `totalQuantity`
  - `perUserLimit`
  - `saleStartAt`
  - `saleEndAt`

- [x] 4.6 Treat these fields as display-only and do not submit them in create/update payloads:
  - `reservedQuantity`
  - `soldQuantity`
  - `availableQuantity`
  - `status`
  - `concertId`

## 5. Validation and Date Handling

- [x] 5.1 Validate `code` and `name` cannot be empty.
- [x] 5.2 Validate `priceVnd >= 0`.
- [x] 5.3 Validate `totalQuantity > 0`.
- [x] 5.4 Validate `perUserLimit > 0`.
- [x] 5.5 Validate `perUserLimit <= totalQuantity`.
- [x] 5.6 Validate `saleStartAt` must be before `saleEndAt` when both are provided.
- [x] 5.7 Use `datetime-local` inputs if practical.
- [x] 5.8 Convert API ISO date strings to `datetime-local` values for editing.
- [x] 5.9 Convert `datetime-local` values to ISO strings before `POST` and `PATCH`.
- [x] 5.10 Do not submit ambiguous raw local strings.
- [x] 5.11 Backend validation remains the source of truth.

## 6. Status and Conflict Handling

- [x] 6.1 Show `Activate` only when status is `INACTIVE`.
- [x] 6.2 Show `Deactivate` only when status is `ACTIVE`.
- [x] 6.3 On activate/deactivate success, refresh the list or update local state.
- [x] 6.4 Repeated activate/deactivate conflicts should show a clear `409` message.
- [x] 6.5 Surface backend `400` messages clearly for validation cases.
- [x] 6.6 Surface backend `409` messages clearly for conflict cases such as duplicate code, invalid total quantity, or repeated status transition.

## 7. Error Handling

- [x] 7.1 Handle `401` with login message and `/login` link.
- [x] 7.2 Handle `403` with organizer permission message.
- [x] 7.3 Handle `404` with not-found message for missing or foreign concert/ticket type.
- [x] 7.4 Handle `409` with conflict message.
- [x] 7.5 Reuse the existing `ApiError` handling pattern.
- [x] 7.6 Do not implement global route guards in this task.

## 8. Scope Boundaries

- [x] 8.1 Do not implement payment changes.
- [x] 8.2 Do not implement order changes.
- [x] 8.3 Do not implement QR issuance.
- [x] 8.4 Do not implement check-in.
- [x] 8.5 Do not implement guest-list import.
- [x] 8.6 Do not change backend unless a real contract mismatch is found and explained first.

## 9. Verification

- [x] 9.1 Run frontend build/lint/test commands if available.
- [x] 9.2 Manually verify organizer can open `/organizer/concerts/:concertId/ticket-types`.
- [x] 9.3 Manually verify ticket-type list renders.
- [x] 9.4 Manually verify empty state renders.
- [x] 9.5 Manually verify organizer can create an `INACTIVE` ticket type.
- [x] 9.6 Manually verify organizer can edit editable ticket-type fields.
- [x] 9.7 Manually verify invalid price, quantity, per-user limit, and date range validations.
- [x] 9.8 Manually verify duplicate code shows `409`.
- [x] 9.9 Manually verify activate changes status to `ACTIVE`.
- [x] 9.10 Manually verify deactivate changes status to `INACTIVE`.
- [x] 9.11 Manually verify dashboard `Quản lý vé` navigates correctly.
- [x] 9.12 Manually verify public concert detail only shows `ACTIVE` ticket types.
- [x] 9.13 Manually verify audience or non-organizer receives `403` handling.
- [x] 9.14 Verify no unrelated backend files are changed.
