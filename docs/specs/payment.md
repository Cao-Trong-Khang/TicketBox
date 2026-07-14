# Đặc tả: Thanh toán

## Mô tả

Tính năng tạo yêu cầu thanh toán qua VNPAY hoặc MoMo, chuyển trình duyệt tới cổng, tiếp nhận xác nhận thành công, chuyển order sang `PAID`, ghi giao dịch, chuyển tồn kho sang sold và kích hoạt phát hành e-ticket.

## Luồng chính

1. Web gửi `orderId`, `amount`, return URL, webhook URL và provider tới `POST /payments`.
2. `PaymentFactory` chọn adapter `vnpay` hoặc `momo`, mỗi adapter có circuit breaker riêng.
3. VNPAY adapter sinh transaction id `vnp_{uuid}`, tạo bộ tham số VNPAY 2.1.0, nhân amount với 100, sắp key, ký HMAC SHA-512 và trả payment URL.
4. MoMo adapter sinh transaction/request/order id `momo_{uuid}`, tạo request `captureWallet`, ký HMAC SHA-256, gọi API create và trả `payUrl` khi `resultCode = 0`.
5. Web chuyển trình duyệt tới `paymentUrl`. Trang return nhận query VNPAY/MoMo; khi response code biểu thị thành công, trang gọi `POST /payments/confirm` với order id, provider và transaction id.
6. `POST /payments/webhook` lấy order id từ `orderId`, `vnp_TxnRef` hoặc `rawPayload.orderId`; khi status là `completed` thì gọi cùng fulfillment. Thiếu status được hiểu là `completed`.
7. Fulfillment tìm order theo UUID id hoặc order code; nếu chưa thấy thì tìm qua `providerTransactionId` đã lưu.
8. Order đã `PAID` được coi là đã xử lý và hàm kết thúc.
9. Với order chưa paid, transaction PostgreSQL cập nhật order thành `PAID`, đặt `paidAt`, tạo `payment_transactions.SUCCESS`, phát hành ticket và chuyển quantity từ reserved sang sold.
10. Sau commit, backend gọi notification cho chủ order.

## Kịch bản lỗi

- Provider name không có trong factory làm create payment thất bại với lỗi unsupported provider.
- MoMo trả HTTP lỗi hoặc `resultCode` khác 0 làm adapter ném lỗi và circuit breaker ghi nhận một failure.
- Sau 3 operation lỗi liên tiếp, circuit chuyển `open` và từ chối operation mới với lỗi `Circuit breaker is open`.
- Sau 30 giây, circuit chuyển `half-open`; một lỗi mở lại circuit, hai thành công đưa circuit về `closed`.
- Confirm/webhook không tìm được order theo id, code hoặc transaction id trả `404 Order not found`.
- Nếu transaction database thất bại, cập nhật order, payment transaction, ticket và inventory cùng rollback.
- Lỗi notification sau fulfillment được bắt và không hoàn tác payment/order/ticket.

## Ràng buộc

- Provider hợp lệ là `vnpay` hoặc `momo`; trong database được lưu thành `VNPAY` hoặc `MOMO`.
- VNPAY dùng HMAC SHA-512; MoMo dùng HMAC SHA-256.
- Mỗi provider có breaker: failure threshold 3, reset timeout 30.000 ms, half-open success threshold 2.
- Payment transaction tạo ở fulfillment có amount bằng `order.totalAmountVnd`, không lấy amount từ callback.
- `payment_transactions.idempotency_key` là duy nhất; `(provider, providerTransactionId)` cũng là duy nhất.
- Fulfillment tạo idempotency key dạng `pay-confirm-{orderId}-{8 ký tự UUID}`.
- Kiểm tra order `PAID` bảo đảm callback lặp tuần tự không phát hành thêm ticket.
- Payment controller trả HTTP 200 cho create, confirm và webhook.

## Tiêu chí chấp nhận

- **Given** request VNPAY hợp lệ, **When** tạo payment, **Then** response có transaction id prefix `vnp_` và URL chứa `vnp_SecureHash`.
- **Given** MoMo trả `resultCode = 0`, **When** tạo payment, **Then** backend trả đúng `payUrl` và transaction id prefix `momo_`.
- **Given** order `PENDING` có item đã reserved, **When** confirm thành công, **Then** order thành `PAID`, payment `SUCCESS`, ticket được tạo, reserved giảm và sold tăng trong một transaction.
- **Given** order đã `PAID`, **When** confirm lại, **Then** fulfillment kết thúc mà không tạo thêm payment/ticket.
- **Given** ba operation provider liên tiếp ném lỗi, **When** gọi lần tiếp theo trước 30 giây, **Then** circuit từ chối operation.
- **Given** order id không tồn tại, **When** confirm, **Then** backend trả `404`.
- **Given** webhook có order id và status khác `completed`, **When** xử lý, **Then** response là `{status: "ok"}` và fulfillment không chạy.
