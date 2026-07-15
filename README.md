# TicketBox

TicketBox là đồ án mô phỏng hệ thống bán vé concert có các luồng chính: xem sự kiện, đặt vé, thanh toán, quản lý concert cho organizer, check-in vé, check-in VIP offline, import danh sách VIP và sinh tiểu sử nghệ sĩ bằng AI.

## Thành Phần

- `frontend/`: Web app React + Vite + TypeScript cho khán giả và organizer.
- `backend/`: API NestJS + Prisma + PostgreSQL.
- `mobile-checkin/`: App Android/Kotlin cho nhân viên check-in.
- `docker-compose.yml`: Stack local gồm frontend, backend, PostgreSQL, Redis, Kafka và MinIO.
- `docs/`, `demo-docs/`, `openspec/`: tài liệu đặc tả và demo.

## Yêu Cầu

Cài trước các công cụ sau:

- Node.js 22 trở lên.
- npm.
- Docker Desktop, nếu chạy bằng Docker Compose hoặc muốn bật PostgreSQL/Redis/Kafka/MinIO nhanh.
- Java 17 và Android Studio, nếu chạy app mobile check-in.

## Port Mặc Định

- Frontend: `http://localhost:5173`
- Backend API: `http://localhost:3000`
- Health check: `http://localhost:3000/health`
- PostgreSQL qua Docker: `localhost:5434`
- Redis: `localhost:6379`
- Kafka: `localhost:9092`
- MinIO API: `http://localhost:9000`
- MinIO Console: `http://localhost:9001`

## Cách 1: Chạy Nhanh Bằng Docker Compose

Đây là cách khuyến nghị để demo toàn bộ hệ thống local.

```powershell
docker compose up --build
```

Mở terminal khác và seed dữ liệu demo:

```powershell
docker compose exec backend npm run prisma:seed
```

Sau đó truy cập:

- Web: `http://localhost:5173`
- API health: `http://localhost:3000/health`

Dừng stack:

```powershell
docker compose down
```

Xoá cả dữ liệu PostgreSQL/MinIO local:

```powershell
docker compose down -v
```

## Cách 2: Chạy Từng Service Để Development

### 1. Bật hạ tầng phụ trợ

```powershell
docker compose up -d postgres redis kafka minio minio-init
```

### 2. Cấu hình backend

```powershell
cd backend
copy .env.example .env
npm install
npm run prisma:deploy
npm run prisma:seed
npm run start:dev
```

Backend sẽ chạy tại `http://localhost:3000`.

Lưu ý: `npm run prisma:seed` sẽ xoá dữ liệu demo cũ và tạo lại dữ liệu mới.

### 3. Cấu hình frontend

Mở terminal mới:

```powershell
cd frontend
copy .env.example .env
npm install
npm run dev
```

Frontend sẽ chạy tại `http://localhost:5173`.

## Tài Khoản Demo

Tất cả tài khoản seed dùng chung mật khẩu:

```text
TicketBox@123456
```

Một số tài khoản có sẵn:

| Vai trò | Email |
| --- | --- |
| Organizer | `organizer@ticketbox.local` |
| Organizer | `organizer2@ticketbox.local` |
| Check-in Staff | `staff1@ticketbox.local` |
| Check-in Staff | `staff2@ticketbox.local` |
| Audience | `audience@ticketbox.local` |
| Audience | `nguyenvana@gmail.com` |
| Audience | `tranbanb@gmail.com` |

## Chạy Mobile Check-in

App mobile mặc định trỏ đến backend deploy:

```properties
TICKETBOX_BACKEND_API_URL=https://ticketbox-backend.vercel.app/
```

Nếu chạy backend local bằng Android emulator, build với URL local:

```powershell
cd mobile-checkin
.\gradlew.bat assembleDebug -PTICKETBOX_BACKEND_API_URL=http://10.0.2.2:3000/
```

Nếu dùng máy thật, thay `10.0.2.2` bằng IP LAN của máy đang chạy backend, ví dụ:

```powershell
.\gradlew.bat assembleDebug -PTICKETBOX_BACKEND_API_URL=http://192.168.1.10:3000/
```

## Lệnh Kiểm Tra

Frontend:

```powershell
cd frontend
npm test
npm run typecheck
npm run build
```

Backend:

```powershell
cd backend
npm test
npm run build
npm run lint
```

Mobile:

```powershell
cd mobile-checkin
.\gradlew.bat test
```

## Biến Môi Trường Quan Trọng

Backend đọc biến môi trường từ `backend/.env`.

Các biến tối thiểu khi chạy local:

- `DATABASE_URL`
- `JWT_ACCESS_SECRET`
- `CHECK_IN_QR_HMAC_SECRET`
- `FRONTEND_ORIGIN`
- `PUBLIC_API_ORIGIN`
- `REDIS_URL`
- `KAFKA_BROKERS`
- `MINIO_ENDPOINT`, `MINIO_PORT`, `MINIO_ACCESS_KEY`, `MINIO_SECRET_KEY`

Các biến thanh toán/AI có thể để trống khi demo cơ bản:

- `VNPAY_TMN_CODE`
- `VNPAY_HASH_SECRET`
- `MOMO_PARTNER_CODE`
- `MOMO_ACCESS_KEY`
- `MOMO_SECRET_KEY`
- `GEMINI_API_KEY`

Frontend đọc `frontend/.env`:

```env
VITE_API_BASE_URL=http://localhost:3000
```

## Dữ Liệu Seed

Seed tạo sẵn:

- 3 organizer.
- 5 nhân viên check-in.
- 35 audience.
- 8 concert với banner ảnh thật.
- Ticket types, orders, payments, tickets, scan logs.
- VIP guests và dữ liệu phục vụ demo import CSV.

Chạy lại seed:

```powershell
cd backend
npm run prisma:seed
```

## Troubleshooting

Nếu backend không kết nối được database, kiểm tra PostgreSQL đã chạy chưa:

```powershell
docker compose ps postgres
```

Nếu đổi schema Prisma hoặc mới clone repo, chạy lại:

```powershell
cd backend
npm run prisma:generate
npm run prisma:deploy
```

Nếu frontend gọi nhầm API, kiểm tra `frontend/.env` có:

```env
VITE_API_BASE_URL=http://localhost:3000
```

Nếu port bị chiếm, dừng container/app đang chạy hoặc đổi port trong `docker-compose.yml` và `.env`.

## Deploy

Ghi chú deploy backend và cấu hình mobile khi dùng backend deploy nằm trong:

```text
backend/DEPLOYMENT.md
```

Docker image backend tự chạy migration bằng `prisma migrate deploy` trước khi start API.
