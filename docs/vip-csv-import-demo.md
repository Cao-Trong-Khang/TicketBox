# VIP CSV Import Demo

This demo uses the local Sponsor CSV Files directory at `backend/prisma/demo-sponsor-csv`.

## Valid Import

VIP CSV imports use `REPLACE_SNAPSHOT` semantics per concert and sponsor source. When a newer sponsor file includes an existing natural guest key (`external_guest_key` when present, otherwise the normalized identity fallback), the worker refreshes that guest's display metadata, allowed gate, guest type, contact fields, and notes while preserving check-in state. When a successful snapshot omits an active guest from the previous completed import, the worker marks that guest `CANCELLED` without hard deleting it; checked-in guests and failed or partial-error snapshots do not trigger cleanup.

Sponsor files must be UTF-8 encoded comma-delimited CSV. Semicolon, tab, and pipe-delimited files are rejected with `UNSUPPORTED_DELIMITER` instead of being parsed with the wrong columns; invalid UTF-8 files are rejected with `INVALID_ENCODING`.
Malformed CSV syntax, including unclosed quotes or non-delimiter characters after a closing quote, is rejected with `MALFORMED_CSV`.
Headers are schema-checked after normalization. Supported headers are `concert_id`, `concert_title`, `sponsor_source`, `external_guest_key`, `full_name`, `email`, `phone`, `sponsor_company`, `company`, `invited_by`, `guest_type`, `allowed_gate`, and `notes`. `full_name` is required, and each file must include at least one identity column: `external_guest_key`, `email`, or `phone`.
Rows reject invalid phone numbers, invalid external guest keys, and overlong field values before creating or updating VIP guests.

1. Start the local infrastructure:

```bash
docker-compose up --build -d postgres redis kafka
```

2. Apply migrations and seed the demo organizer, concert, check-in staff, assignments, and sample VIP data:

```bash
cd backend
npm run prisma:deploy
npm run prisma:seed
```

3. Start the backend API and VIP import worker daemon:

```bash
docker-compose up --build -d backend vip-import-worker
```

The `vip-import-worker` service scans `VIP_CSV_SOURCE_DIR`, enqueues database-backed jobs, claims them, and processes them. The worker polls every `VIP_IMPORT_SCAN_INTERVAL_MS` for files and every `VIP_IMPORT_WORKER_POLL_INTERVAL_MS` for queued jobs.

CSV files are preflighted before being read into memory. By default, `VIP_IMPORT_MAX_FILE_SIZE_BYTES=10485760` and `VIP_IMPORT_MAX_ROWS=10000`; adjust these values in the backend and worker environments for larger sponsor feeds.

For a one-shot local run without the daemon:

```bash
npm run vip-imports:worker:once -- --source-dir=./prisma/demo-sponsor-csv
```

To only enqueue files without processing them, use:

```bash
npm run vip-imports:scan -- ./prisma/demo-sponsor-csv
```

4. Review organizer report output:

```bash
curl -H "Authorization: Bearer <organizer-jwt>" http://localhost:3000/admin/concerts/<concert-id>/vip-imports
curl -H "Authorization: Bearer <organizer-jwt>" http://localhost:3000/admin/concerts/<concert-id>/vip-imports/<import-id>
```

## Failure Scenarios

- `missing-column-vip-guests.csv` records a file-level `MISSING_REQUIRED_COLUMNS` failure.
- `malformed-vip-guests.csv` imports valid rows and records row-level validation errors.
- `duplicate-vip-guests.csv` imports unique rows and records duplicate decisions.
- Files exceeding `VIP_IMPORT_MAX_FILE_SIZE_BYTES` are skipped by the scheduler or recorded by the worker as `VIP_IMPORT_FILE_TOO_LARGE`; files exceeding `VIP_IMPORT_MAX_ROWS` are skipped or failed as `VIP_IMPORT_TOO_MANY_ROWS`.
- Files using `;`, tab, or `|` as delimiters are skipped by the scheduler or failed by the worker as `UNSUPPORTED_DELIMITER`.
- Files that are not valid UTF-8 are skipped by the scheduler or failed by the worker as `INVALID_ENCODING`.
- Files with malformed CSV syntax are skipped by the scheduler or failed by the worker as `MALFORMED_CSV`.
- Files with duplicate, unknown, or identity-less headers fail as `DUPLICATE_HEADERS`, `UNSUPPORTED_COLUMNS`, or `MISSING_IDENTITY_COLUMNS`; rows with invalid phone, invalid external key, or overlong fields are rejected with row-level errors.
- To simulate database-backed queue enqueue failure without stopping the rest of the backend:

```bash
cd backend
$env:VIP_IMPORT_QUEUE_FAIL='1'
npm run vip-imports:scan -- ./prisma/demo-sponsor-csv
```

The scheduler records affected imports as `FAILED_TO_ENQUEUE`; public concert, checkout, payment, and check-in request paths do not depend on this scan command. Do not rely on `QUEUED` imports being processed unless the `vip-import-worker` daemon or `npm run vip-imports:worker:once` is running.
