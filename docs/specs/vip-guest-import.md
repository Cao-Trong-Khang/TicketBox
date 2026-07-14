# Đặc tả: Nhập khách VIP từ CSV

## Mô tả

Worker VIP quét thư mục CSV theo lịch, nhận diện file theo SHA-256, xếp import bằng trạng thái PostgreSQL, kiểm tra file/dòng, cập nhật snapshot khách VIP và lưu báo cáo lỗi/audit cho organizer.

## Luồng chính

1. Worker daemon quét `VIP_CSV_SOURCE_DIR` mặc định mỗi 60 giây; chỉ xét file `.csv` thường.
2. Scanner kiểm tra giới hạn file/dòng, đọc UTF-8, parse CSV dấu phẩy và lấy metadata từ dòng dữ liệu đầu: `concert_id` hoặc `concert_title`, cùng `sponsor_source`.
3. Toàn bộ bytes được băm SHA-256. Import được tìm/tạo theo `(concertId, sourceName, sourceFingerprint)` ở trạng thái `DETECTED`.
4. Publisher database-backed nhận job; scanner cập nhật import sang `QUEUED`, đặt `queuedAt` và audit log.
5. Worker polling mỗi 10 giây, lấy tối đa 10 import `QUEUED`/`RETRYABLE_FAILED`, sắp theo queued/created time và claim bằng conditional update sang `PROCESSING`.
6. Worker đọc lại file, xác minh extension, giới hạn, fingerprint, encoding, delimiter và header.
7. File phải có `full_name` và ít nhất một cột định danh `external_guest_key`, `email`, `phone`. Chỉ các cột allowlist được chấp nhận.
8. Từng dòng được kiểm tra số cột, độ dài, full name, external key, email, phone và định danh. Lỗi được ghi `vip_guest_import_errors`; duplicate trong file được ghi loại `DUPLICATE`.
9. Dòng hợp lệ được xử lý theo batch mặc định 100. Email/phone/name được chuẩn hóa; định danh dùng external key hoặc SHA-256 của email, phone và normalized name.
10. Guest có sẵn được cập nhật từ snapshot; guest mới được tạo với deterministic `qrHash`. Xung đột unique được đọc lại và cập nhật trong transaction.
11. Transaction cuối chuyển guest trong snapshot sang `ACTIVE` hoặc giữ `CHECKED_IN`; nếu file không có rejected/duplicate, guest active của cùng nguồn vắng khỏi snapshot chuyển `CANCELLED`.
12. Import thành `COMPLETED`, lưu counters/importedAt và audit. Organizer có permission/ownership đọc danh sách, detail, lỗi và audit trail qua API.

## Kịch bản lỗi

- Entry không phải file CSV, file quá giới hạn, sai delimiter/UTF-8/CSV hoặc không xác định được concert bị scanner bỏ qua.
- Publisher ném lỗi làm import thành `FAILED_TO_ENQUEUE` với failure code/message; lần scan sau đưa trạng thái này vào nhóm enqueue lại.
- File thay đổi sau khi queued tạo lỗi `SOURCE_FINGERPRINT_MISMATCH` và import `FAILED`.
- Thiếu header, header trùng, cột ngoài allowlist, thiếu `full_name` hoặc thiếu toàn bộ cột định danh làm import `FAILED` với file error.
- Dòng sai được tăng `rejectedRows` và lưu mọi validation error của dòng; duplicate trong file tăng `duplicateRows`.
- Khi file có rejected hoặc duplicate, cleanup guest vắng mặt bị bỏ qua.
- Lỗi worker bất ngờ chuyển import sang `RETRYABLE_FAILED`; polling sau được quyền claim lại.
- Import/report không tồn tại trả `404`; user không phải organizer sở hữu concert trả `403`.

## Ràng buộc

- Kích thước mặc định tối đa 10.485.760 byte; tối đa 10.000 dòng dữ liệu.
- CSV bắt buộc UTF-8, delimiter dấu phẩy và hỗ trợ quoted field/escaped quote.
- Giới hạn chính: full name 128, email 254, phone 32, external key 64, notes 1.000 ký tự.
- Phone sau chuẩn hóa phải có 8–15 chữ số và dấu `+` tùy chọn; email phải khớp định dạng email; external key chỉ gồm chữ, số, `. _ : -`.
- Unique import: `(concertId, sourceName, sourceFingerprint)`.
- Unique guest theo `(concertId, sponsorSource, externalGuestKey)` hoặc partial unique normalized identity của concert/source.
- Import mode là `REPLACE_SNAPSHOT`; trạng thái gồm `DETECTED`, `QUEUED`, `PROCESSING`, `COMPLETED`, `FAILED`, `FAILED_TO_ENQUEUE`, `RETRYABLE_FAILED`.
- API báo cáo yêu cầu JWT, `concert:update`, role organizer và ownership.

## Tiêu chí chấp nhận

- **Given** CSV hợp lệ gắn với concert, **When** scanner chạy, **Then** import duy nhất theo fingerprint được tạo và chuyển `QUEUED`.
- **Given** cùng file không đổi được quét lại, **When** scheduler tìm import, **Then** không tạo import thứ hai.
- **Given** file thay đổi bytes sau queue, **When** worker validate, **Then** import `FAILED` với fingerprint mismatch.
- **Given** một dòng hợp lệ và một dòng email sai, **When** worker xử lý, **Then** accepted/rejected counters là 1/1 và lỗi dòng được lưu.
- **Given** hai dòng cùng định danh trong file, **When** import, **Then** dòng sau được ghi duplicate và không tạo guest thứ hai.
- **Given** snapshot sạch không còn guest active cũ, **When** finalize, **Then** guest đó chuyển `CANCELLED`.
- **Given** snapshot có dòng rejected, **When** finalize, **Then** guest vắng mặt không bị cleanup.
- **Given** organizer khác gọi report, **When** ownership được kiểm tra, **Then** backend trả `403`.
