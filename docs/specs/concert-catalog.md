# Đặc tả: Danh mục concert

## Mô tả

Danh mục concert cung cấp dữ liệu đọc cho trang danh sách và chi tiết: nghệ sĩ, địa điểm, banner, thời gian bán, thời gian biểu diễn, mô tả, sơ đồ SVG, artist bio mới nhất, loại vé đang active và số lượng còn lại.

## Luồng chính

1. `GET /concerts` đọc các concert `PUBLISHED` có `performanceStartAt >= now`, sắp xếp theo thời gian biểu diễn tăng dần.
2. Mỗi item trả thông tin concert và `minPriceVnd` nhỏ nhất trong các loại vé `ACTIVE`; không có loại vé active thì giá nhỏ nhất là `null`.
3. `GET /concerts/:id` chỉ đọc concert `PUBLISHED`, trả banner URL, artist, venue, description, seating SVG và bản `ai_artist_bios` trạng thái `DONE` mới nhất.
4. `GET /concerts/:id/ticket-types` chỉ trả loại vé `ACTIVE`, sắp theo giá rồi code; `availableQuantity` được tính bằng `max(0, total - reserved - sold)`.
5. Web tải detail và ticket types song song. Sau đó web tải lại ticket types mỗi 5 giây để cập nhật giá trị hiển thị.
6. Web render seating SVG đã lưu, liên kết vùng có `data-zone` hoặc `data-ticket-code` với code loại vé, và giới hạn nút chọn theo `min(availableQuantity, perUserLimit)`.
7. Banner URL nội bộ `/uploads/banners/{uuid}.{ext}` được backend đọc từ MinIO và trả đúng MIME type cùng HTTP cache header.

## Kịch bản lỗi

- Concert không tồn tại hoặc không ở `PUBLISHED` trả `404 Concert not found` cho detail và ticket types.
- Tên file banner sai pattern hoặc object không tồn tại trả `404`.
- MinIO timeout hoặc lỗi khi đọc banner trả `503 Service Unavailable`.
- Web giữ lần hiển thị ticket types trước đó nếu lần polling 5 giây bị lỗi.

## Ràng buộc

- Các endpoint catalog backend không gắn auth guard; route web `/concerts` và `/concerts/:id` nằm sau `RequireAuth`.
- Danh sách chỉ xét `performanceStartAt`; detail chỉ xét `PUBLISHED`.
- Artist bio công khai chỉ lấy bản `DONE` mới nhất theo `createdAt` giảm dần.
- Chỉ loại vé `ACTIVE` xuất hiện trong catalog và trong phép tính giá nhỏ nhất.
- `availableQuantity` là snapshot đọc; giá trị giữ vé chính thức được quyết định khi tạo order.
- Banner hỗ trợ JPEG, PNG và WebP; response có `Cache-Control: public, max-age=86400` theo cấu hình mặc định.
- Nội dung SVG được backend làm sạch trước khi lưu; frontend tiếp tục dùng DOMPurify trước khi chèn vào DOM.

## Tiêu chí chấp nhận

- **Given** nhiều concert với trạng thái và thời gian khác nhau, **When** lấy danh sách, **Then** chỉ concert `PUBLISHED` chưa tới giờ biểu diễn được trả theo thứ tự tăng dần.
- **Given** concert có nhiều loại vé active, **When** lấy danh sách, **Then** `minPriceVnd` bằng giá active nhỏ nhất.
- **Given** concert có bio `DONE`, **When** lấy detail, **Then** response chứa nội dung bio hoàn tất mới nhất.
- **Given** loại vé có tổng 100, reserved 15 và sold 40, **When** lấy ticket types, **Then** `availableQuantity` bằng 45.
- **Given** concert không published, **When** gọi detail, **Then** backend trả `404`.
- **Given** web đang mở trang detail, **When** ticket availability thay đổi, **Then** lần polling thành công tiếp theo cập nhật danh sách hiển thị.
