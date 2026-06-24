## 1. Setup

- [x] 1.1 Create the organizer concerts frontend feature folder under `src/features/organizer-concerts`.
- [x] 1.2 Add organizer concert list API helpers using the existing `apiFetch` pattern.
- [x] 1.3 Do not hard-code backend URL; rely on existing frontend API config.
- [x] 1.4 Add TypeScript types for organizer concert list items.

## 2. Routing and Navigation

- [x] 2.1 Add the `/organizer/concerts` route to the app router.
- [x] 2.2 Add a simple `Kênh organizer` navigation link in the app shell.
- [x] 2.3 Do not implement role-based link visibility in this task.

## 3. Dashboard UI

- [x] 3.1 Implement the organizer concerts dashboard page with loading, error, empty, and list states.
- [x] 3.2 Render organizer concert fields:
  - `title`
  - `artistName`
  - `venueName`
  - `startsAt`
  - `endsAt`
  - `status`

- [x] 3.3 Format `startsAt` and `endsAt` in `vi-VN` using timezone `Asia/Ho_Chi_Minh`.
- [x] 3.4 Add placeholder action buttons for `Tạo concert`, `Sửa`, and `Quản lý vé`.
- [x] 3.5 Mark placeholder actions as `Sắp ra mắt`.
- [x] 3.6 Do not link placeholder actions to unimplemented routes in this task.

## 4. Error Handling

- [x] 4.1 Show message `Vui lòng đăng nhập để truy cập kênh organizer` with a `/login` link when the API returns `401`.
- [x] 4.2 Show message `Tài khoản này không có quyền organizer` when the API returns `403`.
- [x] 4.3 Reuse the existing `ApiError`-based error handling pattern.
- [x] 4.4 For other errors, show a generic error state consistent with existing page patterns.

## 5. Styling

- [x] 5.1 Add organizer-specific styles to the shared stylesheet without redesigning the app shell.
- [x] 5.2 Keep the layout consistent with existing concert pages and shared UI components.
- [x] 5.3 Keep changes minimal and scoped to this dashboard.

## 6. Verification

- [x] 6.1 Run frontend build/lint/test commands if available.
- [ ] 6.2 Manually verify the organizer dashboard loads for an organizer user.
- [ ] 6.3 Manually verify the concert list renders with title, artist, venue, dates, and status.
- [ ] 6.4 Manually verify the empty state renders when no concerts are returned.
- [ ] 6.5 Manually verify `401` handling message and `/login` link.
- [ ] 6.6 Manually verify `403` handling message.
- [ ] 6.7 Manually verify placeholder actions are marked `Sắp ra mắt` and do not navigate to unimplemented routes.
- [x] 6.8 Verify no backend files are changed.
