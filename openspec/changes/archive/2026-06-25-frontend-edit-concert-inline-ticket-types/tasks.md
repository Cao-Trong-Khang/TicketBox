## 1. Edit page integration

- [ ] 1.1 Extend the organizer edit page to load and display the concert's ticket types alongside the concert form.
- [ ] 1.2 Add a `Cấu hình vé` section inside `/organizer/concerts/:id/edit` with loading, error, empty, and list states.
- [ ] 1.3 Reuse the existing organizer ticket-type form and validation helpers for inline create and edit flows.
- [ ] 1.4 Ensure ticket-type state is managed independently from the concert form state so concert edits do not reset ticket state.
- [ ] 1.5 Ensure ticket-type actions do not reset or clear concert form fields.
- [ ] 1.6 Ensure the inline ticket-type form does not show `saleStartAt` or `saleEndAt`.

## 2. Ticket-type actions and lifecycle gating

- [ ] 2.1 Enable create, edit, activate, and deactivate ticket-type actions for `UPCOMING` concerts that are not `CANCELLED`.
- [ ] 2.2 Disable or hide all ticket-type mutation actions for `ONGOING`, `ENDED`, and `CANCELLED` concerts.
- [ ] 2.3 Show a clear read-only message for lifecycle-restricted concerts.
- [ ] 2.4 Keep the existing ticket-type validation rules:
  - `code` cannot be empty.
  - `name` cannot be empty.
  - `priceVnd >= 0`.
  - `totalQuantity > 0`.
  - `perUserLimit > 0`.
  - `perUserLimit <= totalQuantity`.

- [ ] 2.5 Handle duplicate ticket code errors locally where practical and via backend `409` when returned.
- [ ] 2.6 After create/update/activate/deactivate, refresh the ticket list or update local state safely.

## 3. Dashboard and routing updates

- [ ] 3.1 Remove or hide the dashboard `Quản lý vé` action from the organizer concert dashboard.
- [ ] 3.2 Keep `Sửa` as the only entry point for editing both concert details and ticket configuration.
- [ ] 3.3 Keep `/organizer/concerts/:concertId/ticket-types` available but redirect it to `/organizer/concerts/:concertId/edit`.
- [ ] 3.4 Keep `Hủy` behavior unchanged.

## 4. Error handling and UX polish

- [ ] 4.1 Reuse the existing `ApiError` handling patterns for ticket-type load and mutation failures.
- [ ] 4.2 Surface backend `400`, `401`, `403`, `404`, and `409` messages clearly in the inline ticket section.
- [ ] 4.3 Keep the existing organizer styling and layout patterns consistent with the current pages.
- [ ] 4.4 Do not change backend, payment, notification, QR, or check-in code.

## 5. Verification and Bug Fixing

- [ ] 5.1 Run frontend build/lint/test commands if available.
- [ ] 5.2 Confirm the dashboard no longer shows `Quản lý vé`.
- [ ] 5.3 Confirm `Sửa` opens `/organizer/concerts/:id/edit`.
- [ ] 5.4 Confirm the legacy ticket-type route redirects to the edit page.
- [ ] 5.5 Confirm the edit page shows concert fields and inline `Cấu hình vé`.
- [ ] 5.6 Confirm the edit page loads existing ticket types.
- [ ] 5.7 Confirm the inline ticket-type form no longer shows `saleStartAt` or `saleEndAt`.
- [ ] 5.8 Confirm an `UPCOMING` concert allows creating ticket types.
- [ ] 5.9 Confirm an `UPCOMING` concert allows editing ticket types.
- [ ] 5.10 Confirm an `UPCOMING` concert allows activating/deactivating ticket types.
- [ ] 5.11 Confirm invalid ticket-type values show validation errors.
- [ ] 5.12 Confirm duplicate ticket code shows local or backend error.
- [ ] 5.13 Confirm adding a ticket type does not clear or reset concert form fields.
- [ ] 5.14 Confirm editing a ticket type does not clear or reset concert form fields.
- [ ] 5.15 Confirm an `ONGOING` concert edit page is read-only for concert fields and ticket-type mutations.
- [ ] 5.16 Confirm an `ENDED` concert edit page is read-only for concert fields and ticket-type mutations.
- [ ] 5.17 Confirm a `CANCELLED` concert edit page is read-only for concert fields and ticket-type mutations.
- [ ] 5.18 Confirm the existing create-concert flow with ticket setup still works.
- [ ] 5.19 Confirm no backend, payment, notification, QR, or check-in code was changed.
- [ ] 5.20 If any verification item fails, fix the bug before marking it complete.
- [ ] 5.21 Only mark verification items complete after actually verifying them.
