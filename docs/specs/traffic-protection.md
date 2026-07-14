# Đặc tả: Bảo vệ lưu lượng

## Mô tả

Backend giới hạn tần suất các thao tác xác thực, tạo order, mutation organizer và check-in bằng counter fixed-window trong Redis. Identity là IP, user hoặc device tùy endpoint; request vượt ngưỡng nhận HTTP 429.

## Luồng chính

1. Endpoint có `@RateLimit` cung cấp prefix, limit, TTL và loại identity cho `RateLimitGuard`.
2. Guard ưu tiên user id khi cấu hình `user_or_ip` và JWT đã gắn user; nếu không, guard lấy IP đầu tiên trong `x-forwarded-for`, rồi `request.ip`, socket remote address hoặc `unknown`.
3. Identity được băm SHA-256; Redis key là `rate-limit:{prefix}:{type}:{fullHash}`.
4. Redis `INCR` counter. Nếu kết quả là 1, service đặt `EXPIRE` theo TTL của endpoint.
5. Counter không vượt limit cho phép request đi vào business logic.
6. Counter vượt limit đọc TTL còn lại, đặt header `Retry-After`, ghi warning với identity hash rút gọn và trả HTTP 429.
7. Check-in service dùng cùng primitive Redis nhưng tự tạo key rõ user/device/concert và tự ném HTTP 429 khi vượt ngưỡng.

## Kịch bản lỗi

- Redis connect/INCR lỗi trả count `null`; rate check cho phép request tiếp tục.
- Redis TTL lỗi làm response 429 có `retryAfterSeconds=null` và không đặt header Retry-After.
- Request không có địa chỉ nhận diện dùng identity `ip:unknown`.
- Request vượt guard limit trả body có status 429, message `Bạn thao tác quá nhanh. Vui lòng thử lại sau.` và thời gian retry.
- Check-in vượt limit trả message `Check-in endpoint rate limit exceeded` và `retryAfterSeconds=60`.

## Ràng buộc

| Thao tác | Prefix/key | Identity | Giới hạn |
| --- | --- | --- | ---: |
| Đăng ký | `auth-register` | IP | 3 / 60 giây |
| Đăng nhập | `auth-login` | IP | 10 / 60 giây |
| Tạo order | `orders-create` | User, fallback IP | 5 / 300 giây |
| Tạo/sửa/hủy concert | `organizer-mutation` | User, fallback IP | 20 / 60 giây |
| Tạo/sửa/activate/deactivate loại vé | `organizer-mutation` | User, fallback IP | 20 / 300 giây |
| Preload check-in | `check-in:preload:user:{userId}:concert:{concertId}` | User + concert | 120 / 60 giây |
| Sync check-in | Hai key user+concert và device+concert | User và device | 300 / 60 giây cho mỗi key |

- Các mutation organizer dùng chung prefix nên cùng user dùng chung counter `organizer-mutation` theo identity.
- Thuật toán là fixed window theo thời điểm counter đầu tiên được tạo, không phải token bucket hoặc sliding window.
- Redis key không chứa email/IP/user id ở dạng rõ; guard dùng SHA-256.
- Check-in key chứa user/device/concert ở dạng rõ và không đi qua `RateLimitGuard`.
- Redis client tắt offline queue, lazy connect và chỉ retry tối đa một lần cho mỗi request.

## Tiêu chí chấp nhận

- **Given** một IP đã đăng ký 3 lần trong window, **When** gửi lần thứ 4, **Then** backend trả 429 trước AuthService.
- **Given** user đã tạo 5 order attempts trong 300 giây, **When** gửi lần thứ 6, **Then** backend trả 429 với Retry-After.
- **Given** hai user từ cùng IP đã xác thực, **When** tạo order, **Then** mỗi user dùng counter riêng theo user id.
- **Given** request chưa có user với identity `user_or_ip`, **When** guard resolve identity, **Then** counter dùng IP.
- **Given** sync chưa vượt user limit nhưng device counter đã vượt, **When** gọi sync, **Then** backend trả 429.
- **Given** Redis không kết nối được, **When** rate check chạy, **Then** request được phép tiếp tục.
- **Given** window hết TTL, **When** request tiếp theo increment key mới, **Then** counter bắt đầu lại từ 1.
