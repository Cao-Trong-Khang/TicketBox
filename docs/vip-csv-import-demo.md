# VIP CSV Import Demo

This demo uses the local Sponsor CSV Files directory at `backend/prisma/demo-sponsor-csv`.

## Valid Import

1. Start the local infrastructure and backend:

```bash
docker-compose up --build -d postgres redis kafka backend
```

2. Apply migrations and seed the demo organizer, concert, check-in staff, assignments, and sample VIP data:

```bash
cd backend
npm run prisma:deploy
npm run prisma:seed
```

3. Detect sponsor CSV files and enqueue imports:

```bash
npm run vip-imports:scan -- ./prisma/demo-sponsor-csv
```

4. Process queued imports:

```bash
npm run vip-imports:worker
```

5. Review organizer report output:

```bash
curl -H "Authorization: Bearer <organizer-jwt>" http://localhost:3000/admin/concerts/<concert-id>/vip-imports
curl -H "Authorization: Bearer <organizer-jwt>" http://localhost:3000/admin/concerts/<concert-id>/vip-imports/<import-id>
```

## Failure Scenarios

- `missing-column-vip-guests.csv` records a file-level `MISSING_REQUIRED_COLUMNS` failure.
- `malformed-vip-guests.csv` imports valid rows and records row-level validation errors.
- `duplicate-vip-guests.csv` imports unique rows and records duplicate decisions.
- To simulate Kafka enqueue failure without stopping the rest of the backend:

```bash
cd backend
$env:VIP_IMPORT_KAFKA_FAIL='1'
npm run vip-imports:scan -- ./prisma/demo-sponsor-csv
```

The scheduler records affected imports as `FAILED_TO_ENQUEUE`; public concert, checkout, payment, and check-in request paths do not depend on this scan command.
