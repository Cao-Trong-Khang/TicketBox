## 1. Backend Rate-Limit Scaffolding

- [x] 1.1 Inspect current NestJS version, dependencies, module wiring, and existing Redis service.
- [x] 1.2 Prefer using `@nestjs/throttler` if it is compatible with the current backend setup.
- [ ] 1.3 If `@nestjs/throttler` is suitable, configure reusable throttling support with the least invasive integration.
- [x] 1.4 If Redis-backed throttling can be integrated cleanly, use Redis-backed storage.
- [x] 1.5 Only create a custom Redis-backed guard/service if `@nestjs/throttler` is not suitable or would be more invasive.
- [x] 1.6 Use a simple fixed-window approach for this MVP; do not hand-roll complex sliding-window logic unless necessary.
- [x] 1.7 Register the rate-limit guard/module so protected routes can apply endpoint-specific limits.

## 2. Endpoint Protection

- [x] 2.1 Apply throttling to `POST /auth/login` with a limit of 5 requests per 15 minutes per IP.
- [x] 2.2 Apply throttling to `POST /auth/register` with a limit of 3 requests per 15 minutes per IP.
- [x] 2.3 Apply throttling to `POST /orders` with a limit of 5 requests per 5 minutes per authenticated user, falling back to IP when user identity is unavailable.
- [x] 2.4 Apply throttling to organizer mutation endpoints with a limit of 20 requests per 5 minutes per authenticated user, falling back to IP when user identity is unavailable.
- [x] 2.5 Keep public concert read endpoints outside strict per-route throttling for this task.
- [x] 2.6 Do not break existing JWT auth guards or role checks.

## 3. Response and Observability

- [x] 3.1 Return HTTP `429` when a request exceeds the configured limit.
- [x] 3.2 Use response message:
      `Bạn thao tác quá nhanh. Vui lòng thử lại sau.`
- [x] 3.3 Include retry-after information when available.
- [x] 3.4 Add concise logging for repeated rate-limit violations without exposing sensitive internals.

## 4. Scope Boundaries

- [x] 4.1 Do not implement CAPTCHA.
- [x] 4.2 Do not implement waiting room.
- [x] 4.3 Do not implement bot scoring.
- [x] 4.4 Do not implement queue-based ticket sale.
- [x] 4.5 Do not change payment, notification, QR, or check-in code.
- [x] 4.6 Do not add frontend changes unless a small error-message adjustment is necessary.

## 5. Verification

- [x] 5.1 Add or update tests covering normal allowed requests and `429` behavior for protected endpoints.
- [x] 5.2 Run backend build/lint/test commands if available.
- [x] 5.3 Manually verify repeated `POST /auth/login` eventually returns `429`.
- [x] 5.4 Manually verify repeated `POST /auth/register` eventually returns `429`.
- [x] 5.5 Manually verify repeated `POST /orders` eventually returns `429`.
- [x] 5.6 Manually verify normal `GET /concerts` still works.
- [x] 5.7 Manually verify authenticated order creation still works under the limit.
- [x] 5.8 Verify no payment, notification, QR, or check-in code is changed.
