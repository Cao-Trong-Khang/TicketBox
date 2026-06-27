## 1. Frontend Routing and Entry Points

- [x] 1.1 Add organizer create route for `/organizer/concerts/new`.
- [x] 1.2 Add organizer edit route for `/organizer/concerts/:id/edit`.
- [x] 1.3 Update the organizer dashboard `Tạo concert` action to navigate to `/organizer/concerts/new`.
- [x] 1.4 Update each organizer dashboard `Sửa` action to navigate to `/organizer/concerts/:id/edit`.
- [x] 1.5 Keep `Quản lý vé` as a placeholder marked `Sắp ra mắt`.
- [x] 1.6 Do not navigate from `Quản lý vé` in this task.

## 2. Organizer Concert API Layer

- [x] 2.1 Extend organizer concert API helpers with:
  - `createOrganizerConcert`
  - `getOrganizerConcertDetail`
  - `updateOrganizerConcert`
  - `publishOrganizerConcert`

- [x] 2.2 Use the existing `apiFetch` pattern.
- [x] 2.3 Do not hard-code backend URL.
- [x] 2.4 Define shared TypeScript types for:
  - organizer concert detail response
  - create concert payload
  - update concert payload
  - create/update/publish responses if needed

- [x] 2.5 Do not change backend APIs in this task unless a clear frontend/backend contract mismatch is found and explained first.

## 3. Organizer Concert Form Experience

- [x] 3.1 Create a shared organizer concert form component for create and edit flows.
- [x] 3.2 Include these form fields:
  - `title`
  - `artistName`
  - `description`
  - `venueName`
  - `venueAddress`
  - `bannerUrl`
  - `seatingSvg`
  - `startsAt`
  - `endsAt`

- [x] 3.3 Treat these fields as required:
  - `title`
  - `artistName`
  - `venueName`
  - `venueAddress`
  - `startsAt`
  - `endsAt`

- [x] 3.4 Add inline validation for required fields.
- [x] 3.5 Add inline validation that `startsAt` must be before `endsAt`.
- [x] 3.6 Use `datetime-local` inputs for `startsAt` and `endsAt` if practical.
- [x] 3.7 Convert API ISO date strings to `datetime-local` form values on edit load.
- [x] 3.8 Convert `datetime-local` values back to ISO strings before `POST` and `PATCH`.
- [x] 3.9 Do not submit ambiguous raw local date strings.
- [x] 3.10 Backend validation remains the source of truth.

## 4. Create Page

- [x] 4.1 Implement the create concert page for `/organizer/concerts/new`.
- [x] 4.2 Submit valid form data to `POST /organizer/concerts`.
- [x] 4.3 Show loading/submitting state while creating.
- [x] 4.4 Show localized error state for failed create requests.
- [x] 4.5 After successful create, navigate to `/organizer/concerts/:id/edit` if the response includes `id`.
- [x] 4.6 If the create response does not include `id`, navigate back to `/organizer/concerts`.

## 5. Edit Page

- [x] 5.1 Implement the edit concert page for `/organizer/concerts/:id/edit`.
- [x] 5.2 Fetch organizer concert detail on load.
- [x] 5.3 Show loading, error, and not-found states.
- [x] 5.4 Submit valid draft updates to `PATCH /organizer/concerts/:id`.
- [x] 5.5 Show loading/submitting state while updating.
- [x] 5.6 If loaded concert status is `PUBLISHED`, disable the update submit button.
- [x] 5.7 For `PUBLISHED` concerts, show note:
      `Concert đã publish, chưa hỗ trợ chỉnh sửa trong MVP.`
- [x] 5.8 Still handle backend `409` conflict gracefully if an update is rejected.

## 6. Publish Flow

- [x] 6.1 Add a publish action on the edit page.
- [x] 6.2 Show or enable publish only when concert status is `DRAFT`.
- [x] 6.3 On publish click, call `POST /organizer/concerts/:id/publish`.
- [x] 6.4 Show loading/submitting state while publishing.
- [x] 6.5 On successful publish, update local status to `PUBLISHED`.
- [x] 6.6 If backend response includes updated concert data, use it.
- [x] 6.7 If backend response does not include updated concert data, update status locally or refetch detail.
- [x] 6.8 Handle backend `400` readiness errors with a clear localized message.
- [x] 6.9 Handle backend `409` conflict responses gracefully.

## 7. Auth and Error Handling

- [x] 7.1 For `401`, show message `Vui lòng đăng nhập để truy cập kênh organizer` with a `/login` link.
- [x] 7.2 For `403`, show message `Tài khoản này không có quyền organizer`.
- [x] 7.3 For `404`, show a localized not-found message.
- [x] 7.4 For `400`, show backend validation message when available.
- [x] 7.5 For `409`, show a clear conflict message.
- [x] 7.6 Reuse the existing `ApiError`-based error handling pattern.
- [x] 7.7 Do not implement a global route guard in this task.

## 8. Styling and UX Consistency

- [x] 8.1 Reuse existing shared UI components where practical.
- [x] 8.2 Keep layout and styling consistent with the organizer dashboard and existing concert pages.
- [x] 8.3 Add only minimal organizer-specific styles to the shared stylesheet if needed.
- [x] 8.4 Do not redesign the app shell.
- [x] 8.5 Do not add image upload, rich text editor, or seat map editor in this task.

## 9. Verification

- [x] 9.1 Run frontend build/lint/test commands if available.
- [ ] 9.2 Manually verify organizer can open `/organizer/concerts/new`.
- [ ] 9.3 Manually verify required field validation.
- [ ] 9.4 Manually verify invalid date range validation.
- [ ] 9.5 Manually verify organizer can create a draft concert.
- [ ] 9.6 Manually verify create success navigates to edit page when `id` is available.
- [ ] 9.7 Manually verify organizer can open edit page for an owned concert.
- [ ] 9.8 Manually verify organizer can update a draft concert.
- [ ] 9.9 Manually verify published concert update is disabled and shows the MVP read-only note.
- [ ] 9.10 Manually verify organizer can publish a valid draft concert.
- [ ] 9.11 Manually verify publish success updates status to `PUBLISHED`.
- [ ] 9.12 Manually verify `400`, `401`, `403`, `404`, and `409` handling where practical.
- [ ] 9.13 Manually verify dashboard `Tạo concert` and `Sửa` actions navigate correctly.
- [ ] 9.14 Manually verify dashboard `Quản lý vé` remains `Sắp ra mắt` and does not navigate.
- [x] 9.15 Verify no unrelated backend files are changed.
