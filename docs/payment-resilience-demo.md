# Kịch bản demo: thanh toán không ổn định và giới hạn vé/user

Tài liệu này dùng cho sandbox/course project. VNPay và MoMo chạy ở sandbox hoặc bằng deterministic provider; không có giao dịch tiền thật. Tuy nhiên, idempotency, xác thực chữ ký, transaction, locking, circuit breaker và reconciliation đều chạy thật.

## 1. Thông điệp chính

TicketBox giải quyết hai lỗi thường chỉ xuất hiện khi có retry hoặc nhiều request đồng thời:

1. Cổng thanh toán chậm, mất callback hoặc gửi callback trùng không được tạo nhiều charge, phát vé trùng hay cho trình duyệt tự đánh dấu đã thanh toán.
2. Một user gửi nhiều request đồng thời với các idempotency key khác nhau vẫn không được vượt giới hạn vé; nhiều user cùng mua vé cuối cũng không được oversell.

```text
Audience -> Order API -> Redis coordination -> PostgreSQL SERIALIZABLE + locks
         -> Payment API -> persist PaymentTransaction -> VNPay/MoMo qua Redis circuit
         -> signed webhook hoặc reconciliation -> conditional settlement -> tickets exactly once
```

## 2. Chuẩn bị trước buổi demo

### 2.1 Khởi động và seed giao diện

Chạy tại thư mục gốc `TicketBox`:

```powershell
docker compose up -d postgres redis kafka minio minio-init
docker compose run --rm backend npm run prisma:deploy
docker compose run --rm backend npm run prisma:seed
docker compose up -d backend frontend
docker compose ps
```

- Frontend: <http://localhost:5173>
- Backend health: <http://localhost:3000/health>
- Audience: `audience@ticketbox.local` / `TicketBox@123456`

Secret VNPay/MoMo chỉ đặt trong `.env`, không commit. Host kết nối PostgreSQL qua `localhost:5434`; chỉ container mới dùng `postgres:5432`.

### 2.2 Tạo database integration riêng

> Integration test xóa dữ liệu trong database mà nó kết nối. Tuyệt đối không trỏ vào database `ticketbox`.

```powershell
docker compose exec -T postgres psql -U ticketbox -d postgres -c 'DROP DATABASE IF EXISTS ticketbox_integration WITH (FORCE);'
docker compose exec -T postgres psql -U ticketbox -d postgres -c 'CREATE DATABASE ticketbox_integration;'

Set-Location backend
$env:DATABASE_URL='postgresql://ticketbox:ticketbox@localhost:5434/ticketbox_integration?schema=public'
$env:RUN_PAYMENT_INTEGRATION='1'
npm run prisma:deploy
```

Giữ terminal này để chạy các lệnh demo. Test chạy tuần tự vì mỗi file chủ động dọn fixture của nó.

## 3. Vấn đề 1 — Cổng thanh toán không ổn định

### 3.1 Mở code trước khi nói

```powershell
code -g src/modules/payments/payments.service.ts:31
code -g src/modules/payments/payments.service.ts:118
code -g src/modules/payments/redis-circuit-breaker.service.ts:60
code -g src/modules/payments/payment-reconciliation.service.ts:19
code -g ../frontend/src/features/orders/pages/PaymentSuccessPage.tsx:10
```

Các đoạn nên trỏ vào:

- `payments.service.ts:31-104`: kiểm tra owner/order, tạo `PaymentTransaction` trước khi gọi provider, fingerprint và initiation lease.
- `payments.service.ts:72-75`: amount, return URL và webhook URL do server lấy từ order/config.
- `payments.service.ts:118-180`: xác minh callback, khóa payment/order, conditional transition và phát vé đúng một lần.
- `redis-circuit-breaker.service.ts:60-80`: circuit tách riêng theo provider; chỉ lỗi hạ tầng làm circuit mở.
- `payment-reconciliation.service.ts:19-42`: mỗi 30 giây query lại payment pending/timeout và claim lease trước khi xử lý.
- `PaymentSuccessPage.tsx:10-27`: browser chỉ lấy `paymentId` rồi hỏi backend; query `vnp_ResponseCode=00` không phải bằng chứng.

### 3.2 Nói về vấn đề

“Khi request tới cổng thanh toán timeout, ta không biết provider đã nhận lệnh hay chưa. Retry mù có thể tạo charge thứ hai. Callback có thể bị mất, gửi trùng hoặc giả mạo. Redirect trên browser có thể bị user tự sửa thành success. Hai callback cùng xử lý còn có thể phát vé hai lần.”

### 3.3 Nói về giải pháp

- `POST /payments/initiate` bắt buộc idempotency key; fingerprint phân biệt exact replay và reuse xung đột.
- Payment attempt được lưu PostgreSQL trước khi gọi provider và có `providerRequestId` ổn định.
- Owner, số tiền và callback URL lấy từ server. DTO whitelist và cấm field lạ.
- VNPay/MoMo adapter xác minh HMAC trước settlement; `/payments/confirm` không tồn tại.
- Settlement khóa payment/order trong transaction `SERIALIZABLE`; chỉ winner được đổi inventory và tạo ticket.
- Timeout/5xx đi qua Redis circuit breaker với key riêng cho VNPay/MoMo.
- Reconciliation query lại trạng thái chưa rõ. Failure/expiry dùng chung đường release; late success thành `REQUIRES_REVIEW`.

### 3.4 Chạy demo thanh toán

Từ `backend`:

```powershell
node --test --test-concurrency=1 -r ts-node/register `
  src/modules/payments/payments-api.integration.spec.ts `
  src/modules/payments/payment-reconciliation.integration.spec.ts `
  src/modules/payments/redis-circuit-breaker.integration.spec.ts
```

Kết quả mong đợi: **5 passed, 0 failed**.

Trong output có thể xuất hiện stack log cho callback giả và `ECONNREFUSED` ở scenario Redis down. Đây là lỗi được test cố ý tạo; dựa vào dòng tổng kết `pass/fail` để kết luận.

Giải thích output:

1. `payment HTTP contract...`: 401 thiếu auth; 403 sai owner; 400 khi sửa amount/URL; `/payments/confirm` trả 404; callback giả bị từ chối; callback ký đúng làm order `PAID` và tạo đúng một ticket.
2. `concurrent callback/reconciliation...`: hai settlement cùng chạy nhưng chỉ một payment `SUCCESS`, một order `PAID`, một ticket, `reserved=0`, `sold=1`.
3. `reconciliation handles...`: lost callback và crashed lease được phục hồi; decline thành `FAILED`; chưa rõ vẫn `TIMEOUT`; late success thành `REQUIRES_REVIEW`.
4. `Redis shares provider-isolated...`: circuit VNPay chia sẻ giữa instance và mở độc lập; MoMo vẫn available; Half-Open chỉ một probe.
5. `Redis failure...`: mất Redis thì admission fail closed, không gọi provider thiếu kiểm soát.

### 3.5 Show provider thật và fixture demo

```powershell
code -g src/modules/payments/providers/vnpay.provider.ts:15
code -g src/modules/payments/providers/momo.provider.ts:15
code -g src/modules/payments/providers/provider-errors.ts:1
code -g src/modules/payments/providers/deterministic-payment.provider.ts:18
```

Deterministic provider chỉ thay phản hồi mạng để tạo `success`, `failure`, `pending`, `timeout`, `outage`; callback vẫn được ký và đi qua adapter xác minh thật. Provider thật vẫn có explicit timeout và query API.

## 4. Vấn đề 2 — Giới hạn vé/user dưới tải đồng thời

### 4.1 Mở code trước khi nói

```powershell
code -g src/modules/orders/orders.service.ts:100
code -g src/modules/orders/orders.service.ts:139
code -g src/modules/orders/orders.service.ts:180
code -g src/modules/orders/orders.service.ts:208
code -g src/modules/orders/orders.service.ts:263
code -g src/modules/orders/checkout-lock.service.ts:6
code -g src/modules/orders/reservation-release.service.ts:1
code -g src/modules/orders/checkout-concurrency.integration.spec.ts:61
```

Các đoạn nên trỏ vào:

- `orders.service.ts:100-101`: Redis lock scope gồm quota theo user/concert và inventory theo ticket type.
- `orders.service.ts:139-142`: PostgreSQL advisory lock và `FOR UPDATE` theo thứ tự ổn định.
- `orders.service.ts:180-206`: quota authoritative gồm order `PAID` và `PENDING` chưa hết hạn.
- `orders.service.ts:208-220`: conditional `UPDATE` chỉ reserve nếu còn inventory.
- `orders.service.ts:263` và `300-309`: transaction `SERIALIZABLE` retry khi serialization conflict.
- `checkout-lock.service.ts`: Redis lease phối hợp nhanh và fail closed; PostgreSQL vẫn là nguồn sự thật.

### 4.2 Nói về vấn đề

“User đã có 2/4 vé và gửi đồng thời hai request, mỗi request mua thêm 2 vé bằng hai idempotency key khác nhau. Nếu chỉ đọc tổng rồi insert ở isolation mặc định, cả hai cùng thấy số 2 và kết quả thành 6/4. Tương tự, hai user có thể cùng nhìn thấy hai vé cuối và tạo oversell.”

Idempotency một mình không giải quyết race vì hai request cố ý dùng hai key khác nhau.

### 4.3 Nói về giải pháp

- Redis khóa đường checkout có contention và fail closed khi coordination mất.
- Trong PostgreSQL `SERIALIZABLE`, code lấy advisory lock cho quota và row lock cho ticket type.
- Quota tính từ `PAID` cộng reservation `PENDING` còn hạn, đúng scope user + concert + ticket type.
- Inventory reserve bằng conditional `UPDATE`; thiếu vé làm toàn transaction rollback, không có partial row.
- Expiry và payment failure tranh nhau qua conditional order transition; chỉ một bên release reservation.

### 4.4 Chạy demo concurrency

```powershell
node --test --test-concurrency=1 -r ts-node/register `
  src/modules/orders/checkout-concurrency.integration.spec.ts
```

Kết quả mong đợi: **5 passed, 0 failed**.

Ý nghĩa năm scenario:

1. User có 2/4 vé, hai request khác key cùng mua 2: tối đa một request thắng, tổng không quá 4.
2. Hai user tranh inventory còn 2 trên hai ticket type: đúng một transaction thắng, không oversell, không partial rows.
3. Redis down hoặc lock bận: request fail trước khi có mutation PostgreSQL.
4. Payment failure chạy đồng thời expiry: đúng một bên release, `reservedQuantity` về 0 chứ không âm.
5. Redis lease hết hạn và cache stale: quyết định cuối vẫn theo PostgreSQL authoritative.

## 5. Chứng minh invariant sau demo

Mở SQL trước:

```powershell
code -g prisma/verify-payment-invariants.sql:1
```

Chạy trên database integration:

```powershell
Get-Content prisma/verify-payment-invariants.sql -Raw |
  docker compose exec -T postgres psql -U ticketbox -d ticketbox_integration
```

Kết quả đúng chỉ có header `kind | entity` và **0 rows**. SQL chứng minh:

- Không trùng `provider_request_id`.
- Không có order `PAID` thiếu payment `SUCCESS`.
- Inventory counter không âm hoặc vượt total.
- Số ticket của paid order item đúng bằng quantity.

## 6. Demo giao diện tùy chọn

Để không phụ thuộc mạng sandbox, tại thư mục gốc bật deterministic payment rồi recreate backend:

```powershell
Set-Location ..
$env:PAYMENT_DEMO_VNPAY_BEHAVIOR='success'
$env:PAYMENT_DEMO_MOMO_BEHAVIOR='success'
$env:PAYMENT_DEMO_DELAY_MS='500'
docker compose up -d --force-recreate backend frontend
```

Đăng nhập Audience, tạo order và chọn provider. Trang redirect không tự kết luận success; nó poll `GET /payments/:paymentId`. Reconciliation chạy mỗi 30 giây và chỉ xử lý attempt đủ stale, nên có thể hiện “Đang chờ” trước khi thành công. Integration test vẫn là bằng chứng chính cho race condition.

Mô phỏng VNPay hỏng nhưng MoMo còn dùng được:

```powershell
$env:PAYMENT_DEMO_VNPAY_BEHAVIOR='outage'
$env:PAYMENT_DEMO_MOMO_BEHAVIOR='success'
docker compose up -d --force-recreate backend
```

Trả về provider sandbox thật:

```powershell
Remove-Item Env:PAYMENT_DEMO_VNPAY_BEHAVIOR -ErrorAction SilentlyContinue
Remove-Item Env:PAYMENT_DEMO_MOMO_BEHAVIOR -ErrorAction SilentlyContinue
Remove-Item Env:PAYMENT_DEMO_DELAY_MS -ErrorAction SilentlyContinue
docker compose up -d --force-recreate backend
```

## 7. Kiểm tra toàn bộ trước ngày demo

```powershell
# Backend unit tests
Set-Location backend
Remove-Item Env:RUN_PAYMENT_INTEGRATION -ErrorAction SilentlyContinue
npm test
npm run build

# Frontend
Set-Location ../frontend
npm test
npm run build
```

Mốc đã xác minh ngày 2026-07-14:

- Backend: 197 passed, 0 failed; 10 integration tests skip mặc định; build passed.
- Frontend: 65 passed, 0 failed; build passed.
- Integration Docker PostgreSQL/Redis: 10 passed, 0 failed.
- Docker image backend/frontend build được; `/health` và frontend root trả HTTP 200.

## 8. Dọn database integration

Chỉ dọn sau khi demo xong:

```powershell
Set-Location ..
docker compose exec -T postgres psql -U ticketbox -d postgres -c 'DROP DATABASE IF EXISTS ticketbox_integration WITH (FORCE);'
Remove-Item Env:RUN_PAYMENT_INTEGRATION -ErrorAction SilentlyContinue
Remove-Item Env:DATABASE_URL -ErrorAction SilentlyContinue
```

## 9. Câu kết luận

“TicketBox không giả định network hay callback là đáng tin. Payment được định danh và lưu trước khi gọi provider, chỉ dữ liệu xác minh từ server mới được settlement, và state transition quan trọng đều conditional. Với checkout, Redis giúp phối hợp nhưng PostgreSQL locking/serialization là nguồn sự thật. Vì vậy retry, callback trùng và concurrent checkout không làm charge/phát vé trùng, vượt quota hoặc oversell.”

Ngoài phạm vi: production settlement, refund, recurring payment, provider ngoài VNPay/MoMo và ngăn một người tạo nhiều tài khoản.
