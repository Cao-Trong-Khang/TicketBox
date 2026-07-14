# Đặc tả: Xác thực và kiểm soát truy cập

## Mô tả

Tính năng cung cấp đăng ký, đăng nhập, làm mới phiên, đăng xuất và hồ sơ người dùng cho web và ứng dụng check-in. Backend quyết định quyền bằng vai trò, permission, quyền sở hữu concert và assignment của nhân viên check-in.

Ba vai trò được seed là `AUDIENCE`, `ORGANIZER` và `CHECKIN_STAFF`. Người đăng ký mới nhận vai trò `AUDIENCE` trong cùng transaction tạo user.

## Luồng chính

1. Đăng ký nhận email hợp lệ, password dài 8–128 ký tự và display name tùy chọn tối đa 120 ký tự.
2. Backend chuẩn hóa email thành chữ thường, băm password bằng bcrypt 12 rounds, tạo user `ACTIVE` và gán vai trò `AUDIENCE` trong một transaction.
3. Đăng nhập chuẩn hóa email, kiểm tra user `ACTIVE` và so sánh bcrypt hash.
4. Backend tạo access token JWT chứa `sub` và `email`, đồng thời sinh refresh token ngẫu nhiên 48 byte. Chỉ bcrypt hash của refresh token được lưu với hạn 30 ngày.
5. `POST /auth/refresh` tìm refresh token chưa thu hồi và chưa hết hạn, thu hồi token cũ rồi tạo cặp token mới trong một transaction.
6. `POST /auth/logout` yêu cầu Bearer JWT và refresh token thuộc chính user; token được đánh dấu `revokedAt` và endpoint trả `204`.
7. `GET /auth/me` dùng JWT để trả id, email, display name, status và danh sách role hiện tại từ database.
8. `JwtAuthGuard` xác minh chữ ký và hạn JWT. `PermissionsGuard` tải permission qua `user_roles`, `roles`, `role_permissions` và `permissions`, rồi yêu cầu user có đủ mọi permission trên endpoint.
9. Service organizer lọc theo `organizerId`; service check-in yêu cầu role `CHECKIN_STAFF`, permission và assignment đúng concert/gate/device.
10. API quản lý role chuẩn hóa role code thành chữ hoa, ghi thay đổi role và audit log trong cùng transaction. API phân công check-in xác minh organizer sở hữu concert và user đích có role `CHECKIN_STAFF`.

## Kịch bản lỗi

- Email đăng ký đã tồn tại trả `409 Conflict`.
- Dữ liệu đăng ký/đăng nhập sai định dạng bị global validation pipe từ chối.
- Email hoặc password đăng nhập sai, hoặc user không `ACTIVE`, trả `401 Unauthorized`.
- Refresh token không tồn tại, đã hết hạn hoặc đã thu hồi trả `401 Unauthorized`.
- Logout bằng refresh token không thuộc user đang đăng nhập trả `401 Unauthorized`.
- JWT thiếu, sai chữ ký hoặc hết hạn bị `JwtAuthGuard` từ chối.
- Thiếu một permission bắt buộc trả `403 Forbidden`.
- Truy cập concert không thuộc organizer trả `404` trong các service quản trị concert; phân công staff trên concert của organizer khác trả `403`.
- Gán role đã có hoặc gán staff lần hai cho cùng concert trả `409`; user/role/assignment không tồn tại trả `404`.

## Ràng buộc

- Access token dùng Bearer header, secret từ `JWT_ACCESS_SECRET`, TTL mặc định `1h`.
- Refresh token có hạn 30 ngày, được rotate khi refresh và chỉ lưu dưới dạng bcrypt hash.
- Email user là duy nhất; cặp `(userId, roleId)` là duy nhất.
- `AUDIENCE`: `concert:read`, `ticket:purchase`, `ticket:read_own`.
- `ORGANIZER`: đọc/tạo/sửa/hủy concert, quản lý loại vé và đọc analytics.
- `CHECKIN_STAFF`: đọc concert, preload, scan và sync check-in.
- Role/permission phía frontend chỉ điều khiển navigation; backend guard và kiểm tra ownership/assignment quyết định quyền truy cập dữ liệu.
- Gán hoặc gỡ role và gán hoặc gỡ check-in staff được ghi audit log cùng transaction thay đổi.

## Tiêu chí chấp nhận

- **Given** email chưa tồn tại và dữ liệu hợp lệ, **When** đăng ký, **Then** user `ACTIVE` được tạo với password hash và role `AUDIENCE`.
- **Given** user active và password đúng, **When** đăng nhập, **Then** response có access token, refresh token và profile chứa role.
- **Given** refresh token hợp lệ, **When** refresh, **Then** token cũ bị thu hồi và cặp token mới được phát hành.
- **Given** refresh token đã bị logout, **When** dùng lại để refresh, **Then** backend trả `401`.
- **Given** user không có permission endpoint yêu cầu, **When** gọi API, **Then** backend trả `403` trước business logic.
- **Given** organizer A và concert của organizer B, **When** A đọc hoặc sửa bằng API quản trị, **Then** dữ liệu concert không được trả về.
- **Given** staff có đủ permission nhưng không có assignment, **When** preload concert, **Then** backend trả `403`.
