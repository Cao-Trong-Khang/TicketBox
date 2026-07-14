# Đặc tả: Thống kê bán vé và doanh thu

## Mô tả

Dashboard doanh thu cho organizer tổng hợp số liệu một concert thuộc sở hữu của họ: tổng doanh thu đã thanh toán, số order paid, tổng vé, đã bán, đang giữ, còn lại, tỷ lệ bán và breakdown theo loại vé.

## Luồng chính

1. Web gọi `GET /organizer/concerts/:id/revenue` từ route organizer.
2. Backend yêu cầu JWT, permission `concert:analytics:read`, role organizer và ownership concert.
3. Service tải song song tất cả ticket types, các order `PAID` có `paidAt != null` và order items thuộc các order đó.
4. Tổng doanh thu concert là tổng `totalAmountVnd` của paid orders; `paidOrderCount` là số order trong tập này.
5. Tổng sold/reserved/total lấy từ các counter của ticket types. Availability mỗi loại và toàn concert bằng `max(0, total - reserved - sold)`.
6. Doanh thu từng loại vé là tổng `subtotalVnd` của paid order items cùng `ticketTypeId`.
7. `soldRate` bằng sold/total; nếu total bằng 0 thì tỷ lệ là 0.
8. Ticket types được sắp theo giá rồi code; frontend định dạng VND, phần trăm và hiển thị summary cùng breakdown.

## Kịch bản lỗi

- Thiếu/không hợp lệ JWT trả `401`.
- Thiếu permission analytics hoặc role organizer trả `403`.
- Concert không tồn tại hoặc không thuộc organizer trả `404 Concert not found`.
- Frontend nhận lỗi 401/403/404 hiển thị thông báo tương ứng thay cho dashboard.

## Ràng buộc

- Chỉ order `PAID` đồng thời có `paidAt` mới đóng góp doanh thu và paid order count.
- Doanh thu dùng dữ liệu tiền đã lưu trên order/order item, không nhân lại giá hiện tại của ticket type.
- Số vé đã bán và đang giữ dùng `soldQuantity`/`reservedQuantity` hiện tại của ticket type.
- Dashboard không dùng Redis cache; mỗi request đọc PostgreSQL.
- Organizer chỉ xem concert có `organizerId` của chính mình.

## Tiêu chí chấp nhận

- **Given** concert có paid và pending orders, **When** lấy revenue, **Then** chỉ paid orders có `paidAt` được cộng doanh thu và count.
- **Given** paid item quantity 2, subtotal 600.000 cho ticket type A, **When** tổng hợp, **Then** revenue của A tăng 600.000.
- **Given** ticket type total 100, sold 40, reserved 10, **When** trả breakdown, **Then** available là 50 và soldRate là 0,4.
- **Given** concert không có ticket type, **When** lấy revenue, **Then** các tổng số lượng/tỷ lệ bằng 0 và danh sách breakdown rỗng.
- **Given** organizer A gọi revenue concert của B, **When** service kiểm tra ownership, **Then** backend trả `404`.
