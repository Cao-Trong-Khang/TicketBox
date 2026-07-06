# Đặc tả: Kiểm soát tải đột biến

## Mô tả

Tính năng kiểm soát tải đột biến trong TicketBox hiện được triển khai bằng sự kết hợp giữa rate limiting theo route, Redis cache cho public read APIs, và các cơ chế bảo vệ luồng tạo order trong backend. Mục tiêu là giảm request spam vào các endpoint có rủi ro cao như đăng ký, đăng nhập, tạo order và mutation của organizer; đồng thời giảm tải đọc lên PostgreSQL trong giai đoạn nhiều người cùng xem concert và availability.

Ở backend, cơ chế rate limiting được triển khai trong `backend/src/modules/rate-limit/` với `RateLimitGuard`, `RateLimitService` và decorator `@RateLimit(...)`. Redis được dùng để lưu bộ đếm với TTL. Các endpoint ghi quan trọng hiện đã được bảo vệ bằng giới hạn cụ thể theo IP hoặc theo user/IP.

Ở public read path, `ConcertsService` áp dụng cache-aside với Redis cho danh sách concert, chi tiết concert và danh sách ticket type/availability. Điều này giúp nhiều request đọc liên tiếp không phải truy cập PostgreSQL trực tiếp nếu dữ liệu đã có trong cache.

Ở luồng tạo order, hệ thống bảo vệ bằng ba lớp chính:

1. idempotency key theo `userId + idempotencyKey`
2. reserve inventory trong transaction
3. câu lệnh cập nhật atomic để không oversell

Ngoài ra, `OrderExpirationService` sẽ tự động thu hồi lượng vé đang giữ chỗ của các order `PENDING` đã hết hạn, giúp availability được hồi phục cho những request mua tiếp theo.

Tuy nhiên, cơ chế hiện tại có giới hạn rõ ràng:

- không có waiting room hoặc virtual queue
- không có CAPTCHA hoặc bot challenge
- không có cơ chế anti-bot nâng cao như fingerprint hoặc bot scoring
- fairness giữa người dùng thật mới chỉ được hỗ trợ gián tiếp qua rate limit và anti-oversell, chưa có admission control hoàn chỉnh
- rate limit hiện là route-level, không phải global
- khi Redis dùng cho rate limit bị lỗi, hệ thống hiện fail-open và cho request đi tiếp

## Luồng chính

### Luồng 1: Request đăng ký / đăng nhập / tạo order đi qua rate limit

1. Client gửi request đến endpoint được gắn `@UseGuards(RateLimitGuard)` và `@RateLimit(...)`.
2. `RateLimitGuard` đọc cấu hình giới hạn từ metadata của route.
3. Guard xác định danh tính áp hạn mức:
   - theo IP nếu route dùng `identity: 'ip'`
   - theo user nếu có JWT, nếu không thì theo IP nếu route dùng `identity: 'user_or_ip'`
4. `RateLimitService` tạo Redis key dạng `rate-limit:{prefix}:{type}:{hash}`.
5. `RedisCacheService.incrementWithTtl()` tăng bộ đếm trong Redis và gắn TTL nếu là lần đầu.
6. Nếu bộ đếm chưa vượt ngưỡng, request tiếp tục vào controller/service.
7. Nếu bộ đếm vượt ngưỡng, backend trả `429 Too Many Requests` và gắn `Retry-After`.

Các giới hạn đang được triển khai:

- `POST /auth/register`: `3` request / `60` giây / IP
- `POST /auth/login`: `10` request / `60` giây / IP
- `POST /orders`: `5` request / `300` giây / user hoặc IP
- `POST /organizer/concerts`, `PATCH /organizer/concerts/:id`, `POST /organizer/concerts/:id/cancel`
- Các mutation của `/organizer/concerts/:concertId/ticket-types/*`

### Luồng 2: Public concert list / detail / ticket-types đi qua cache

1. Client gọi:
   - `GET /concerts`
   - `GET /concerts/:id`
   - `GET /concerts/:id/ticket-types`
2. `ConcertsService` kiểm tra Redis trước:
   - `concerts:list:published`
   - `concerts:detail:{id}`
   - `concerts:{id}:ticket-types`
3. Nếu cache hit và parse được JSON, service trả dữ liệu từ cache.
4. Nếu cache miss, service đọc từ PostgreSQL, map sang DTO và ghi lại vào Redis với TTL tương ứng.
5. TTL hiện tại:
   - concert list: `60` giây
   - concert detail: `300` giây
   - ticket types / availability: `5` giây
6. Nếu cache JSON bị hỏng, service xóa key lỗi và fallback về PostgreSQL.
7. Sau các mutation liên quan concert hoặc ticket type, cache liên quan sẽ bị xóa để lần đọc sau tự làm mới.

### Luồng 3: Audience tạo order với idempotency key

1. Frontend ở `ConcertDetailPage.tsx` tạo `idempotencyKey` mới bằng `crypto.randomUUID()`.
2. Frontend gửi `POST /orders` kèm `concertId`, `items`, `idempotencyKey`.
3. `OrdersService` kiểm tra trước xem đã tồn tại order cùng `userId + idempotencyKey` hay chưa.
4. Nếu đã tồn tại, backend trả lại order cũ thay vì tạo mới.
5. Nếu chưa có, backend tiếp tục vào transaction tạo order.

### Luồng 4: Backend reserve inventory bằng thao tác atomic

1. Trong transaction, backend xác thực concert tồn tại, đang `PUBLISHED`, còn trong sale window.
2. Backend tải toàn bộ ticket type được chọn và kiểm tra trạng thái, quantity hợp lệ, per-user limit.
3. Backend kiểm tra tổng số vé cùng loại mà user đã có trong các order `PENDING` và `PAID`.
4. Với từng item, backend chạy câu lệnh SQL cập nhật có điều kiện:
   - tăng `reserved_quantity`
   - chỉ thành công khi lượng vé còn lại đủ lớn
5. Nếu câu lệnh update trả `0`, backend trả `409 Conflict` với lỗi không đủ vé.
6. Nếu reserve thành công cho tất cả item, backend tạo `Order` trạng thái `PENDING` và tạo các `OrderItem`.
7. Sau transaction, backend xóa cache `concerts:{concertId}:ticket-types`.

### Luồng 5: Pending order hết hạn và release reserved quantity

1. `OrderExpirationService` chạy theo cron mỗi `60` giây.
2. Service lấy tối đa `100` order `PENDING` có `expiresAt <= now`.
3. Với từng order, service mở transaction riêng.
4. Nếu order vẫn còn `PENDING`, service chuyển trạng thái sang `EXPIRED`.
5. Service giảm `reserved_quantity` của các ticket type liên quan.
6. Sau đó service xóa cache `concerts:{concertId}:ticket-types`.
7. Availability được phục hồi cho các request tiếp theo.

### Luồng 6: Frontend giảm gửi request lặp lại

1. Khi người dùng bấm “Tiếp tục đặt vé”, `ConcertDetailPage.tsx` bật `isSubmitting = true`.
2. `TicketSelectionSummary.tsx` disable nút submit trong lúc request đang chạy.
3. Trang đăng nhập và đăng ký cũng disable nút submit trong lúc đang gửi form.
4. Frontend poll ticket availability mỗi `5` giây trong `ConcertDetailPage.tsx`.
5. Nếu poll lỗi, frontend bỏ qua lỗi và không spam retry ngay lập tức.

## Kịch bản lỗi

### Vượt rate limit

- Khi client vượt quá ngưỡng của route được bảo vệ, backend trả `429`.
- Response chứa thông điệp giới hạn tốc độ và `Retry-After`.

### Redis unavailable trong rate limiting

- Nếu Redis không tăng được bộ đếm, `RateLimitService` hiện cho request đi tiếp.
- Đây là fail-open behavior.
- Hệ quả là tính bảo vệ chống spam bị suy giảm khi Redis rate limit gặp lỗi.

### Redis unavailable trong cache

- Nếu Redis đọc cache lỗi hoặc không có dữ liệu, `ConcertsService` fallback về PostgreSQL.
- Nếu Redis xóa cache lỗi sau mutation hoặc order expiration, request chính không bị fail.
- Hệ thống chấp nhận eventual consistency của cache.

### Cache miss

- Khi cache miss, public read APIs đọc dữ liệu trực tiếp từ PostgreSQL và ghi lại vào Redis.
- Điều này vẫn hoạt động đúng nhưng tạo áp lực lớn hơn lên database nếu traffic đọc tăng cao.

### Hết vé / không đủ vé

- Nếu số vé khả dụng không đủ ở thời điểm reserve, câu lệnh SQL update không cập nhật dòng nào.
- Backend trả `409 Conflict`.
- Không tạo order mới và không tăng `reserved_quantity`.

### Duplicate idempotency key

- Nếu cùng user gửi lại cùng `idempotencyKey`, backend trả lại order cũ.
- Hệ thống không tạo trùng order mới cho cùng một khóa idempotency.

### Pending order expiration

- Nếu order `PENDING` quá `15` phút, worker sẽ chuyển sang `EXPIRED`.
- Lượng vé đã giữ chỗ được trả lại.
- Cache availability bị xóa để dữ liệu công khai được làm mới.

### Concurrent high request vào create order

- Hệ thống có chống oversell nhờ reserve inventory atomic.
- Tuy nhiên kiểm tra `per-user limit` hiện vẫn diễn ra trước bước reserve và chưa được khóa đồng bộ tuyệt đối cho nhiều request cùng user.
- Vì vậy hệ thống bảo vệ tốt hơn về inventory hơn là fairness quota tuyệt đối.

### Payment không ảnh hưởng public read APIs

- Public concert list / detail / ticket-types không phụ thuộc payment callback để hoạt động.
- Tạo order và payment là luồng riêng.
- Việc payment chưa hoàn tất không làm hỏng public read APIs.

## Ràng buộc

1. Rate limiting hiện là route-level, không phải global.
2. Public read APIs hiện được cache nhưng không có rate limit riêng trong controller public.
3. Redis được dùng cho:
   - rate limiting counter
   - cache concert list/detail/ticket-types
   - cache invalidation sau mutation và order expiration
4. Rate limit hiện fail-open nếu Redis counter không hoạt động.
5. Hệ thống không có waiting room, virtual queue hoặc admission control.
6. Hệ thống không có CAPTCHA, bot challenge, bot scoring hoặc fingerprinting.
7. Hệ thống có idempotency cho create order nhưng chưa có cơ chế fairness queue cho giờ mở bán.
8. Hệ thống có anti-oversell ở mức inventory reservation, nhưng chưa đủ để khẳng định per-user limit hoàn toàn an toàn dưới cạnh tranh đồng thời của cùng một user.
9. Spec này không bao phủ revenue dashboard, check-in, notification hay payment processing, trừ khi chúng ảnh hưởng trực tiếp đến cơ chế spike protection.

## Tiêu chí chấp nhận

1. Các endpoint đã gắn `@RateLimit(...)` phải trả `429` khi vượt ngưỡng cấu hình hiện tại.
2. `POST /auth/register` phải bị chặn sau `3` request / `60` giây / IP.
3. `POST /auth/login` phải bị chặn sau `10` request / `60` giây / IP.
4. `POST /orders` phải bị chặn sau `5` request / `300` giây / user hoặc IP.
5. Public concert list phải dùng Redis key `concerts:list:published` với TTL `60` giây.
6. Public concert detail phải dùng Redis key `concerts:detail:{id}` với TTL `300` giây.
7. Public ticket types / availability phải dùng Redis key `concerts:{id}:ticket-types` với TTL `5` giây.
8. Create order phải idempotent theo cặp `userId + idempotencyKey`.
9. Create order không được oversell inventory khi nhiều request cạnh tranh cùng một ticket type.
10. Pending order hết hạn phải trả lại `reserved_quantity`.
11. Frontend phải disable submit lặp lại trong lúc request tạo order đang chạy.
12. Tài liệu và hệ thống không được tuyên bố đã có waiting room, CAPTCHA hoặc fairness admission control nếu code chưa triển khai các cơ chế đó.
