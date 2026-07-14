# Đặc tả: Notification

## Mô tả

Notification gửi xác nhận mua vé sau fulfillment và nhắc concert trước giờ biểu diễn. `NotificationFactory` cung cấp bốn channel `email`, `push`, `sms`, `zalo`; mỗi provider được bọc bởi circuit breaker riêng.

## Luồng chính

1. Payment fulfillment gọi `NotificationsService.send` với type `ticket_purchase` và bốn channel sau khi transaction order/ticket đã commit.
2. Service xác minh request có `userId`, `type` và object `data`, rồi xử lý channel tuần tự.
3. Email provider dùng Nodemailer SMTP, dựng subject/body HTML từ type và gửi tới `data.email`.
4. Push provider tạo message id, title và raw payload chứa device token/project id.
5. SMS provider tạo message id và payload gửi tới `phoneNumber` hoặc `phone`; Zalo provider tạo payload tới `zaloId` hoặc `phone`.
6. Mỗi kết quả trả message id, channel, status và raw payload. Lỗi một provider được đổi thành result `failed`; các channel sau vẫn được xử lý.
7. Reminder cron chạy theo biểu thức `0 * * * *`, tức đầu mỗi giờ. Job tìm concert có `performanceStartAt` từ 24 đến 25 giờ sau thời điểm chạy.
8. Với mỗi ticket `ACTIVE`, job gửi type `event_reminder` cho owner qua bốn channel, rồi đặt marker Redis theo concert/user trong 48 giờ.
9. `POST /notifications` nhận request trực tiếp; nếu không truyền channels thì dùng toàn bộ channel factory.

## Kịch bản lỗi

- Request thiếu/không đúng kiểu `userId`, `type` hoặc `data` làm service ném `BadRequestException`.
- Channel không tồn tại làm factory ném lỗi; service trả result `failed` cho channel đó và tiếp tục.
- SMTP hoặc provider ném lỗi được log và chuyển thành result có message id rỗng, status `failed`.
- Ba lần gửi lỗi liên tiếp mở circuit của provider; lời gọi khi circuit open trở thành result `failed`.
- Lỗi truy vấn trong reminder job được bắt và ghi error, không thoát scheduler.
- Redis lỗi khi đọc marker được xử lý như chưa có marker; lỗi ghi marker chỉ tạo warning trong Redis service.

## Ràng buộc

- Provider được xử lý tuần tự theo thứ tự channel đầu vào.
- Circuit breaker cho từng channel có threshold 3, reset 30 giây và cần 2 thành công ở half-open.
- Email dùng host/port/credentials cấu hình; port 465 bật `secure`.
- Marker reminder là `reminder:sent:concert:{concertId}:user:{userId}`, TTL 172.800 giây.
- Reminder chỉ xét `performanceStartAt` và ticket status `ACTIVE`.
- Kết quả gửi notification không tham gia transaction payment/ticket.
- Type có template email riêng là `ticket_purchase`, `event_reminder` và subject cho `cancellation`.

## Tiêu chí chấp nhận

- **Given** request hợp lệ với hai channel, **When** gửi, **Then** providers được gọi tuần tự và response có hai kết quả tương ứng.
- **Given** SMTP gửi thành công, **When** gửi `ticket_purchase`, **Then** email chứa concert, order code và amount.
- **Given** một provider ném lỗi, **When** gửi nhiều channel, **Then** channel đó có status `failed` và channel kế tiếp vẫn chạy.
- **Given** concert bắt đầu trong cửa sổ 24–25 giờ và owner có ticket `ACTIVE`, **When** cron chạy, **Then** reminder được gửi và marker 48 giờ được ghi.
- **Given** marker reminder đã là `true`, **When** cron chạy lại, **Then** user đó không nhận lời gọi gửi lần nữa cho concert.
- **Given** request không truyền channel, **When** gọi `/notifications`, **Then** service xử lý email, push, sms và zalo.
