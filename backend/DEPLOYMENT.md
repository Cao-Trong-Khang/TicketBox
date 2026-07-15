# Backend Deployment

The backend is a NestJS API with Prisma/PostgreSQL. Redis is used for cache, rate limiting, and payment circuit breaker state. Kafka and MinIO are needed for the optional artist bio and VIP import worker flows.

On Vercel, artist biography processing automatically runs inline in the request and stores the extracted PDF text in PostgreSQL. This avoids relying on a persistent Kafka worker or local MinIO service. Set `AI_BIO_PROCESSING_MODE=worker` only on infrastructure where Kafka, MinIO, and the AI bio worker are available.

## Required Runtime Variables

Set these in the deployment platform:

- `DATABASE_URL`
- `JWT_ACCESS_SECRET`
- `CHECK_IN_QR_HMAC_SECRET`
- `FRONTEND_ORIGIN`
- `PUBLIC_API_ORIGIN`
- `REDIS_URL`

For a production-like full feature deployment, also set:

- `KAFKA_BROKERS`
- `MINIO_ENDPOINT`
- `MINIO_PORT`
- `MINIO_USE_SSL`
- `MINIO_ACCESS_KEY`
- `MINIO_SECRET_KEY`
- `MINIO_BUCKET`
- `BANNERS_BUCKET`

Use `.env.production.example` as the complete checklist.

## Docker Deployment

Build and run the image from this directory:

```bash
docker build -t ticketbox-backend .
docker run --rm -p 3000:3000 --env-file .env.production ticketbox-backend
```

The container runs `prisma migrate deploy` before starting `node dist/main.js`.

Health check:

```bash
curl http://localhost:3000/health
```

## Mobile Connection

The Android app reads the backend URL from the Gradle property `TICKETBOX_BACKEND_API_URL`.

The repository default is currently:

```properties
TICKETBOX_BACKEND_API_URL=https://ticketbox-backend.vercel.app/
```

Build against the deployed Vercel backend:

```powershell
cd mobile-checkin
.\gradlew.bat assembleDebug
```

Override for a local Android emulator backend:

```powershell
cd mobile-checkin
.\gradlew.bat assembleDebug -PTICKETBOX_BACKEND_API_URL=http://10.0.2.2:3000/
```

Use HTTPS for real devices unless you intentionally keep `android:usesCleartextTraffic="true"` for a local demo.
