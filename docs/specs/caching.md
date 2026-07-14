# Đặc tả: Caching

## Mô tả

Catalog concert dùng Redis theo chiến lược cache-aside để giảm truy vấn PostgreSQL cho danh sách, detail và loại vé. Service đọc cache trước, truy vấn database khi miss rồi lưu JSON với TTL cố định. PostgreSQL vẫn là nguồn dữ liệu chính thức.

## Luồng chính

1. Danh sách đọc key `concerts:list:published`; cache hit được parse và trả ngay.
2. Cache miss truy vấn concert `PUBLISHED` chưa biểu diễn, map DTO và set JSON trong 60 giây.
3. Detail dùng key `concerts:detail:{concertId}`; miss đọc concert và bio `DONE` mới nhất rồi set 300 giây.
4. Loại vé dùng key `concerts:{concertId}:ticket-types`; miss đọc loại vé `ACTIVE`, tính availability và set 5 giây.
5. Update/cancel concert xóa đồng thời list, detail và ticket-types key; create concert xóa list key.
6. Mutation loại vé, tạo order và hết hạn order xóa ticket-types key của concert.
7. Hoàn tất, sửa hoặc xóa artist bio/document xóa detail key.
8. Khi key hết TTL, request kế tiếp rebuild từ PostgreSQL. Số vé hiển thị tự làm mới sau tối đa TTL 5 giây hoặc sớm hơn khi key bị invalidation.

## Kịch bản lỗi

- Redis get lỗi được bắt trong `RedisCacheService`, ghi warning và trả `null`; caller xử lý như cache miss.
- Redis set/del lỗi được ghi warning và không làm hỏng response nghiệp vụ.
- JSON detail hoặc ticket-types bị lỗi parse làm key bị xóa rồi backend đọc lại database.
- Concert không tồn tại trong database sau cache miss trả `404`.
- Nếu Redis đang ở trạng thái `wait` hoặc `end`, service thử connect trước operation; connect lỗi đi vào fallback tương ứng.

## Ràng buộc

| Dữ liệu | Key | TTL |
| --- | --- | ---: |
| Danh sách concert published | `concerts:list:published` | 60 giây |
| Chi tiết concert | `concerts:detail:{concertId}` | 300 giây |
| Loại vé và availability | `concerts:{concertId}:ticket-types` | 5 giây |

- Giá trị cache là JSON của DTO trả về, không phải Prisma entity thô.
- Availability cache bằng `max(0, totalQuantity - reservedQuantity - soldQuantity)` tại lúc rebuild.
- Tạo order quyết định tồn kho bằng conditional update PostgreSQL; không đọc availability từ Redis.
- Redis client dùng `enableOfflineQueue=false`, `lazyConnect=true`, `maxRetriesPerRequest=1`.
- Invalidation chạy sau khi mutation database thành công; lỗi invalidation không rollback mutation.
- Các key catalog không dùng version suffix.

## Tiêu chí chấp nhận

- **Given** key danh sách hợp lệ, **When** lấy catalog, **Then** backend trả JSON cache mà không truy vấn concert database.
- **Given** key detail không tồn tại, **When** lấy detail, **Then** backend đọc PostgreSQL và set key với TTL 300 giây.
- **Given** JSON ticket-types hỏng, **When** đọc cache, **Then** key bị xóa và response được rebuild từ database.
- **Given** organizer cập nhật concert, **When** mutation thành công, **Then** ba key list/detail/ticket types được yêu cầu xóa.
- **Given** order được tạo thành công, **When** transaction commit, **Then** key ticket types của concert bị xóa.
- **Given** Redis lỗi, **When** đọc catalog, **Then** backend vẫn trả dữ liệu từ PostgreSQL.
- **Given** availability cache còn hiệu lực, **When** checkout, **Then** quyết định giữ chỗ vẫn dùng conditional update PostgreSQL.
