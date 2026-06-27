## 1. Create concert page integration

- [x] 1.1 Add a `Cấu hình vé` section/button inside `/organizer/concerts/new`.
- [x] 1.2 Allow organizers to add one or more local ticket types before final submit.
- [x] 1.3 Require at least one ticket type before the final create action can succeed.
- [x] 1.4 Disable the final submit action while the multi-step create flow is running.
- [x] 1.5 Show useful loading/submitting state while the concert and ticket types are being created.

## 2. Ticket type fields in create flow

- [x] 2.1 Add ticket type fields: `code`, `name`, `priceVnd`, `totalQuantity`, `perUserLimit`.
- [x] 2.2 Remove `saleStartAt` from the create-flow ticket type UI.
- [x] 2.3 Remove `saleEndAt` from the create-flow ticket type UI.
- [x] 2.4 Omit `saleStartAt` and `saleEndAt` from create-flow ticket type payloads.

## 3. Validation

- [x] 3.1 Keep existing concert required fields unchanged.
- [x] 3.2 Enforce `startsAt` before `endsAt` for the concert form.
- [x] 3.3 Reject empty ticket `code` and `name` values.
- [x] 3.4 Enforce `priceVnd >= 0`.
- [x] 3.5 Enforce `totalQuantity > 0`.
- [x] 3.6 Enforce `perUserLimit > 0`.
- [x] 3.7 Enforce `perUserLimit <= totalQuantity`.
- [x] 3.8 Reject duplicate ticket codes within the local create form before submit.

## 4. Submit flow

- [x] 4.1 Keep the backend unchanged for this MVP.
- [x] 4.2 First call `POST /organizer/concerts` to create the concert as DRAFT.
- [x] 4.3 Then call `POST /organizer/concerts/:concertId/ticket-types` for each local ticket type.
- [x] 4.4 After each ticket type is created, activate it using the existing activate endpoint.
- [x] 4.5 If all steps succeed, navigate to `/organizer/concerts/:id/edit`.

## 5. Partial failure handling

- [x] 5.1 If concert creation succeeds but ticket type creation or activation fails, show the recovery message: `Concert đã được tạo nhưng một số loại vé chưa hoàn tất. Vui lòng kiểm tra lại trong trang Quản lý vé.`
- [x] 5.2 Provide navigation to `/organizer/concerts/:id/ticket-types` after a partial failure.
- [x] 5.3 Reuse existing `ApiError` handling for the recovery experience.

## 6. Existing ticket type management page

- [x] 6.1 Keep `/organizer/concerts/:concertId/ticket-types` intact.
- [x] 6.2 Remove `saleStartAt` and `saleEndAt` from the create form on the management page.
- [x] 6.3 Remove `saleStartAt` and `saleEndAt` from the edit form on the management page.
- [x] 6.4 Do not send `saleStartAt` or `saleEndAt` in POST/PATCH payloads from the management page.
- [x] 6.5 Keep activate/deactivate behavior unchanged.
- [x] 6.6 Keep the dashboard `Quản lý vé` navigation pointing to this page.

## 7. Public behavior

- [x] 7.1 Confirm public API behavior remains unchanged.
- [x] 7.2 Confirm public ticket type visibility still depends on concert published state and ticket type active state.
- [x] 7.3 Do not change public APIs in this task.

## 8. UX and styling

- [x] 8.1 Keep styling consistent with existing organizer pages.
- [x] 8.2 Reuse existing organizer components and helpers where practical.

## 9. Verification and Bug Fixing

- [x] 9.1 Run frontend build/lint/test commands if available.

- [x] 9.2 Continue completing all unchecked verification tasks in this section.
  - Do not stop at build success.
  - Manually verify the actual create concert flow in the browser or through the available local frontend workflow.
  - If a verification step reveals a bug, fix the bug before marking the step as complete.

- [x] 9.3 Manually verify the create page shows `Cấu hình vé`.

- [x] 9.4 Manually verify that adding a ticket type does **not** clear or reset any concert form fields.
  - Open `/organizer/concerts/new`.
  - Fill at least:
    - `title`
    - `artistName`
    - `venueName`
    - `venueAddress`
    - `startsAt`
    - `endsAt`
    - `description`
    - `bannerUrl`
    - `seatingSvg`

  - Open/use `Cấu hình vé`.
  - Fill ticket type fields:
    - `code`
    - `name`
    - `priceVnd`
    - `totalQuantity`
    - `perUserLimit`

  - Click `Thêm loại vé`.
  - All concert fields must remain unchanged.
  - Only the ticket-type input fields may reset after adding a ticket type.

- [x] 9.5 If any concert field is cleared/reset after clicking `Thêm loại vé`, treat it as a blocking bug and fix it before continuing.
  - Check whether the ticket-type add button is accidentally submitting the parent concert form.
  - Ensure non-submit buttons use `type="button"`.
  - Ensure adding a local ticket type updates only ticket-type state.
  - Ensure ticket-type form reset clears only ticket-type inputs, not concert inputs.
  - Ensure concert form state is owned by the create page or otherwise preserved correctly.
  - Ensure component keys or conditional rendering do not force-remount the concert form.
  - After fixing, repeat step 9.4 and only mark this task complete when concert fields stay unchanged.

- [x] 9.6 Verify the page cannot create without at least one ticket type.

- [x] 9.7 Verify the ticket form no longer shows `saleStartAt` or `saleEndAt`.

- [x] 9.8 Verify duplicate local ticket codes are rejected before submit.

- [x] 9.9 Verify successful create creates the concert, creates ticket types, and activates them.

- [x] 9.10 Verify newly created ticket types are `ACTIVE` after successful create flow.

- [x] 9.11 Verify success navigates to `/organizer/concerts/:id/edit`.

- [x] 9.12 Verify partial failure shows the recovery message and link to ticket management:
      `Concert đã được tạo nhưng một số loại vé chưa hoàn tất. Vui lòng kiểm tra lại trong trang Quản lý vé.`

- [x] 9.13 Verify the existing ticket management page no longer shows `saleStartAt` or `saleEndAt`.

- [ ] 9.14 Verify public concert detail still shows `ACTIVE` ticket types only after publish.

- [x] 9.15 After all bug fixes, rerun frontend build/lint/test commands if available.

- [x] 9.16 Summarize:
  - which manual checks were performed
  - whether the reset-form bug was reproduced
  - what caused the bug if it was found
  - what files were changed
  - which verification steps are now complete
  - any verification steps that could not be completed and why
