# Đặc tả: Quản lý concert và loại vé

## Mô tả

Tính năng cho organizer tạo, xem, cập nhật và hủy concert thuộc sở hữu của mình; tải banner; quản lý loại vé, giá, sức chứa, thời gian bán, giới hạn mỗi user và trạng thái active/inactive.

## Luồng chính

1. Organizer tải banner qua multipart field `file`. Backend kiểm tra role, loại file, phần mở rộng, kích thước, lưu object `banners/{uuid}.{ext}` vào MinIO và trả URL nội bộ.
2. Tạo concert nhận title, artist, venue, ba mốc thời gian và các trường tùy chọn. Backend kiểm tra thời gian, làm sạch SVG, tạo concert trực tiếp ở `PUBLISHED` với `organizerId` của JWT.
3. Dashboard organizer liệt kê riêng concert của user, mới tạo trước, và tính lifecycle `UPCOMING`, `ONGOING` hoặc `ENDED` từ `startsAt`/`endsAt`.
4. Cập nhật merge các trường được gửi với bản ghi hiện tại, kiểm tra lại toàn bộ ba mốc thời gian khi một mốc thay đổi, làm sạch SVG mới và cập nhật concert.
5. Hủy concert chuyển status sang `CANCELLED`.
6. Tạo loại vé xác minh ownership, code duy nhất trong concert, giá/số lượng/quota và cửa sổ bán; bản ghi mới bắt đầu ở `INACTIVE`. Nếu thiếu `saleStartAt`, backend dùng thời điểm tạo.
7. Cập nhật loại vé merge dữ liệu cũ/mới, bảo vệ phần số lượng đã reserved/sold, rồi lưu thay đổi.
8. Activate/deactivate chuyển trạng thái giữa `ACTIVE` và `INACTIVE` sau khi kiểm tra trạng thái hiện tại.
9. Mọi mutation xóa các key cache công khai liên quan; lỗi xóa cache không làm rollback dữ liệu đã lưu.

## Kịch bản lỗi

- User không có role/permission organizer trả `403`; concert không thuộc user trả `404`.
- Dữ liệu ngày sai định dạng, `startsAt >= endsAt` hoặc `endsAt >= performanceStartAt` trả `400`.
- Concert `CANCELLED`, đang trong thời gian bán hoặc đã hết thời gian bán không được cập nhật/hủy và trả `409`.
- SVG rỗng, không có thẻ `svg`, chứa tag nguy hiểm hoặc lớn hơn 200 KB trả `400`.
- Banner thiếu, sai MIME/extension, MIME không khớp extension hoặc quá 5 MB bị từ chối; lỗi MinIO trả `503`.
- Code loại vé trùng trong cùng concert trả `409`.
- `perUserLimit > totalQuantity`, cửa sổ bán không tăng dần hoặc giá/số lượng/quota ngoài miền hợp lệ trả `400`.
- Giảm `totalQuantity` xuống thấp hơn `reservedQuantity + soldQuantity` trả `409`.
- Activate loại vé đã active hoặc deactivate loại vé đã inactive trả `409`.

## Ràng buộc

- Tạo/sửa/hủy concert yêu cầu các permission tương ứng; quản lý loại vé yêu cầu `concert:ticket_type:manage`.
- Organizer chỉ thao tác concert có `organizerId` bằng user id trong JWT.
- `title`, `artistName`, `venueName`, `venueAddress`, `startsAt`, `endsAt`, `performanceStartAt` là bắt buộc khi tạo và không nhận `null` khi patch.
- Thứ tự thời gian bắt buộc: `startsAt < endsAt < performanceStartAt`.
- `priceVnd >= 0`, `totalQuantity >= 1`, `perUserLimit >= 1` và `perUserLimit <= totalQuantity`.
- Nếu có `saleEndAt` thì `saleStartAt < saleEndAt`.
- `(concertId, code)` là unique constraint cho loại vé.
- SVG chỉ giữ tập tag/attribute allowlist, loại bỏ event handler, `style` và các tag thực thi/nhúng.

## Tiêu chí chấp nhận

- **Given** organizer hợp lệ và dữ liệu thời gian đúng, **When** tạo concert, **Then** concert `PUBLISHED` thuộc organizer được lưu.
- **Given** SVG có event handler và tag không nằm trong allowlist nhưng không chứa blocked tag, **When** lưu concert, **Then** các thành phần không được phép bị loại khỏi SVG đã lưu.
- **Given** concert của organizer khác, **When** gọi update, **Then** backend trả `404`.
- **Given** concert đang `ONGOING`, **When** update hoặc cancel, **Then** backend trả `409`.
- **Given** loại vé mới hợp lệ, **When** tạo, **Then** status ban đầu là `INACTIVE` và availability bằng total quantity.
- **Given** loại vé đã có 20 reserved và 30 sold, **When** giảm total xuống 49, **Then** backend trả `409`.
- **Given** mutation thành công, **When** request kết thúc, **Then** key catalog liên quan được yêu cầu xóa khỏi Redis.
