# Đặc tả: Mua vé và quản lý tồn kho

## Mô tả

Tính năng cho audience tạo order từ một hoặc nhiều loại vé, giữ tồn kho trong 15 phút, áp dụng giới hạn mỗi user, tự hết hạn order chưa thanh toán và nhả số lượng đã giữ. PostgreSQL là nguồn quyết định tồn kho.

## Luồng chính

1. Web tạo UUID v4 làm `idempotencyKey` và gửi concert cùng danh sách item tới `POST /orders`.
2. Backend tìm order theo `(userId, idempotencyKey)` trước transaction; nếu tồn tại thì trả lại order đó.
3. Backend từ chối `ticketTypeId` trùng trong request.
4. Trong transaction, backend xác minh concert tồn tại, `PUBLISHED`, thời điểm hiện tại không trước `concert.startsAt` và không sau `concert.endsAt`.
5. Backend tải tất cả loại vé thuộc concert, yêu cầu từng loại `ACTIVE`, quantity nguyên dương và không lớn hơn `perUserLimit`.
6. Với từng item, backend cộng quantity trong các order cùng user có status `PENDING` hoặc `PAID`; tổng sau request không được vượt `perUserLimit`.
7. Với từng loại vé, backend chạy atomic conditional `UPDATE`: tăng `reserved_quantity` chỉ khi `total - reserved - sold` còn đủ. Một item thất bại làm rollback toàn transaction.
8. Backend tính tiền từ `priceVnd` trong database, tạo order code `TBX...`, order `PENDING`, `expiresAt = now + 15 phút` và các order item.
9. Sau commit, response trả id, code, status, tổng tiền và hạn thanh toán.
10. Cron mỗi 60 giây lấy tối đa 100 order `PENDING` đã quá hạn. Mỗi order được claim bằng conditional update sang `EXPIRED`, rồi giảm reserved của từng item trong transaction.
11. `GET /orders/history` trả tối đa 100 order của chính user, mới nhất trước, kèm concert và tổng hợp item.

## Kịch bản lỗi

- Payload không có item, UUID sai hoặc quantity không phải số nguyên dương bị validation từ chối.
- Concert/loại vé không tồn tại trả `404`.
- Concert không published, chưa mở bán, đã hết thời gian bán, loại vé không active, vượt quota hoặc không đủ tồn kho trả `409`.
- `ticketTypeId` lặp trong cùng request trả `400`.
- Conditional update của bất kỳ item nào trả 0 thì transaction rollback, không giữ một phần order.
- Cron bỏ qua order đã rời `PENDING` trước lúc claim.
- Lỗi khi xử lý một order hết hạn được log và không ngăn cron tiếp tục với order kế tiếp.

## Ràng buộc

- API order yêu cầu JWT, permission `ticket:purchase`; history yêu cầu `ticket:read_own`.
- Idempotency key là UUID v4 và unique theo user.
- Order code là duy nhất; tổng tiền và đơn giá luôn lấy từ database.
- Order giữ chỗ đúng 15 phút kể từ thời điểm backend tạo.
- Tồn kho khả dụng bằng `totalQuantity - reservedQuantity - soldQuantity`.
- Chống overselling dùng conditional update trong transaction, không dùng giá trị cache.
- Quota user tính các order `PENDING` và `PAID` của cùng ticket type.

## Tiêu chí chấp nhận

- **Given** request hợp lệ và đủ vé, **When** tạo order, **Then** reserved tăng đúng quantity và order/item được commit cùng nhau.
- **Given** cùng user gửi lại idempotency key đã lưu, **When** tạo order, **Then** backend trả order cũ mà không tăng reserved lần nữa.
- **Given** một item trong order nhiều item không đủ vé, **When** tạo order, **Then** không item nào được giữ và không order nào được tạo.
- **Given** tổng quantity `PENDING`/`PAID` của user cộng request vượt quota, **When** tạo order, **Then** backend trả `409`.
- **Given** hai request cạnh tranh phần tồn kho cuối, **When** conditional updates chạy, **Then** chỉ transaction còn đủ availability được commit.
- **Given** order `PENDING` quá hạn, **When** cron chạy, **Then** order thành `EXPIRED` và reserved giảm đúng theo các item.
- **Given** user A gọi history, **When** backend truy vấn, **Then** response không chứa order của user B.
