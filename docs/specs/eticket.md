# Đặc tả: E-ticket và QR

## Mô tả

E-ticket được phát hành sau khi fulfillment payment thành công. Mỗi vé thuộc một user, order, order item, concert và loại vé; API của user trả signed QR token dùng cho soát vé.

## Luồng chính

1. Trong transaction fulfillment, backend lặp đúng `quantity` của từng order item.
2. Mỗi ticket nhận code `TK-{orderCode}-{ticketTypeCode}-{sequence}`, nonce `qrHash` từ UUID bỏ dấu gạch, status `ACTIVE` và `issuedAt` tự động.
3. `GET /tickets/me` xác thực JWT và permission `ticket:read_own`, rồi lọc `ownerUserId` bằng user id trong token.
4. Vé được sắp theo thời gian bắt đầu concert rồi ticket code.
5. Khi tạo response, backend ký QR token HMAC SHA-256 chứa version, entity type `TICKET`, ticket id, concert id, issuer, issuedAt, expiresAt và nonce bằng `qrHash` đã lưu.
6. Nếu concert có `endsAt`, token hết hạn sau `endsAt` cộng grace mặc định 7 ngày; nếu không có, token hết hạn sau `issuedAt` cộng 30 ngày.
7. Web lọc ticket theo order đang xem và yêu cầu `api.qrserver.com` kết xuất `signedQrToken` thành ảnh QR.
8. Check-in thành công chuyển ticket từ `ACTIVE` sang `USED` và ghi `checkedInAt`. Ticket `CANCELLED` bị từ chối tại check-in.

## Kịch bản lỗi

- Thiếu JWT hoặc JWT không hợp lệ bị auth guard từ chối.
- User thiếu `ticket:read_own` trả `403`.
- User không sở hữu ticket không nhận ticket đó trong response.
- QR sai cấu trúc ba phần, sai HMAC, sai header, issuer, version, entity type hoặc đã hết hạn được check-in đánh dấu `INVALID_QR`.
- QR có id hợp lệ nhưng nonce/concert không khớp ticket được đánh dấu `INVALID_QR` hoặc `UNAUTHORIZED`.
- Ticket `CANCELLED`, đã `USED` hoặc đã có check-in thành công nhận kết quả tương ứng và không tạo check-in success mới.

## Ràng buộc

- `ticketCode` và `qrHash` là unique trong PostgreSQL.
- Secret HMAC bắt buộc dài ít nhất 32 ký tự; issuer mặc định là `ticketbox`.
- QR token dùng định dạng ba phần base64url với header `alg=HS256`, `typ=JWT`.
- Nonce trong token phải bằng `tickets.qr_hash` tại thời điểm check-in.
- Status ticket là `ACTIVE`, `USED` hoặc `CANCELLED`.
- Chỉ payment fulfillment tạo ticket; số ticket bằng tổng quantity order items.
- Một ticket chỉ có tối đa một check-in `SUCCESS` nhờ partial unique index.

## Tiêu chí chấp nhận

- **Given** order có tổng 3 vé, **When** fulfillment commit, **Then** đúng 3 ticket `ACTIVE` với code và qrHash duy nhất được tạo.
- **Given** user A và user B có vé riêng, **When** A gọi `/tickets/me`, **Then** chỉ vé có `ownerUserId = A` được trả.
- **Given** ticket thuộc concert có `endsAt`, **When** tạo signed token, **Then** `expiresAt` bằng thời gian kết thúc cộng grace đã cấu hình.
- **Given** signed token hợp lệ và ticket `ACTIVE`, **When** backend check-in, **Then** token được xác minh bằng HMAC và nonce database.
- **Given** token bị sửa payload, **When** check-in, **Then** kết quả là `INVALID_QR`.
- **Given** check-in success, **When** transaction hoàn tất, **Then** ticket thành `USED` và có `checkedInAt`.
