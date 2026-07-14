# Đặc tả: Check-in ngoại tuyến và đồng bộ

## Mô tả

Ứng dụng Android cho `CHECKIN_STAFF` tải trước ticket/khách VIP của concert được phân công, quét bằng CameraX + ML Kit, xác thực sơ bộ từ Room, lưu mọi scan bền vững và đồng bộ tới backend bằng WorkManager. PostgreSQL quyết định kết quả check-in cuối cùng.

## Luồng chính

1. Staff đăng nhập, app lưu access token/staff info trong `SharedPreferences`, tạo và giữ `sourceDeviceId` dạng `android-{uuid}`.
2. App tải assignment của chính staff. Preload yêu cầu concert và assignment hợp lệ; backend trả concert, gate, snapshot version/time, ticket và khách VIP thuộc import `COMPLETED` phù hợp gate.
3. Backend tạo signed QR token cho từng ticket/VIP. Room version 4 thay thế snapshot, ticket và VIP của concert trong một transaction, đồng thời giữ scan logs riêng.
4. Khi quét, app tra payload theo ticket code/signed token hoặc VIP token trong Room.
5. Local validator yêu cầu snapshot, thực thể có trong snapshot, status `ACTIVE` và chưa có scan local accepted. Snapshot cũ hơn 12 giờ trả `stale_snapshot`; backend vẫn quyết định khi sync.
6. Gate của VIP được so không phân biệt hoa thường. Kết quả local cùng UUID `localScanId`, device, timestamp và metadata được chèn vào `local_scan_logs` với `syncStatus=pending`.
7. WorkManager xếp unique work `check-in-sync-{concertId}`, chỉ chạy khi có mạng, `ExistingWorkPolicy.KEEP`, exponential backoff từ 30 giây.
8. Mobile gửi tối đa 100 log sẵn sàng mỗi batch với mode `offline`. Backend kiểm tra role, hai permission scan/sync, assignment và rate limit user/device.
9. Với từng scan, backend tìm `(sourceDeviceId, localScanId)` trước. Bản ghi đã có được trả lại với `idempotent=true`.
10. Scan mới chạy trong transaction riêng: kiểm tra thời gian client, chữ ký QR, entity/concert/nonce, gate, trạng thái ticket/VIP, trạng thái paid của order và thời hạn concert.
11. Scan hợp lệ tạo `check_ins.SUCCESS`; ticket thành `USED` hoặc VIP thành `CHECKED_IN`. Backend trả outcome cho từng local scan và mobile cập nhật log thành synced.

## Kịch bản lỗi

- Không có snapshot hoặc payload không nằm trong snapshot trả local result `invalid` nhưng scan log vẫn được lưu.
- Payload đã accepted trên cùng device hoặc thực thể đã `USED/CHECKED_IN` trả local `duplicate`.
- Ticket/VIP `CANCELLED`, `REFUNDED` hoặc không `ACTIVE` trả local `invalid`.
- Staff thiếu role/permission/assignment hoặc VIP sai gate bị backend từ chối/ghi `UNAUTHORIZED`.
- `scannedAt` vượt tương lai quá 5 phút hoặc cũ quá 24 giờ được ghi `INVALID_QR`.
- QR sai chữ ký, issuer, version, entity, nonce hoặc payment context được ghi kết quả invalid/cancelled tương ứng.
- Thực thể đã success trên cùng thiết bị trả `ALREADY_USED`; success trên thiết bị khác trả `CONFLICT`.
- Hai transaction cùng cố tạo success: partial unique index giữ một bản ghi; lỗi unique được bắt và lưu conflict cho lượt còn lại.
- HTTP 429, HTTP 5xx hoặc lỗi mạng làm mobile giữ log pending, tăng retry count và đặt lần retry theo exponential delay.
- HTTP 4xx khác 429 được chuyển ra cho caller thay vì đánh dấu batch retry.

## Ràng buộc

- Room database `ticketbox-checkin.db` lưu assignments, snapshots, preloaded tickets, preloaded VIP guests và local scan logs.
- `(sourceDeviceId, localScanId)` là duy nhất cả ở Room và PostgreSQL.
- Backend DTO nhận 1–200 scans/request; repository mobile mặc định gửi 100.
- Clock skew mặc định 300 giây; offline grace mặc định 86.400 giây.
- Một ticket hoặc VIP guest chỉ có tối đa một `check_ins.SUCCESS`.
- `serverReceivedAt/serverCheckedInAt` quyết định thời gian check-in; client timestamp được lưu ở `clientScannedAt`.
- Retry delay local là `30 giây × 2^retryCount`, exponent chặn ở 6; WorkManager cũng dùng exponential backoff tối thiểu 30 giây.

## Tiêu chí chấp nhận

- **Given** staff có assignment, **When** preload, **Then** Room nhận snapshot, ticket và VIP đúng concert/gate trong một transaction.
- **Given** mất mạng và ticket active trong snapshot, **When** quét, **Then** app trả local accepted và lưu log pending bền vững.
- **Given** cùng payload đã accepted trên device, **When** quét lại offline, **Then** local result là duplicate và scan mới vẫn được ghi lịch sử.
- **Given** pending logs và mạng trở lại, **When** WorkManager chạy, **Then** batch được upload và outcome cập nhật đúng local scan id.
- **Given** request sync lặp cùng device/local id, **When** backend xử lý, **Then** không tạo check-in mới và response có `idempotent=true`.
- **Given** hai thiết bị sync cùng ticket active, **When** transaction cạnh tranh, **Then** đúng một success tồn tại và lượt còn lại nhận conflict.
- **Given** sync gặp HTTP 500, **When** repository xử lý lỗi, **Then** log vẫn pending với retry count và thời điểm retry mới.
