## Context

The backend POST /orders API is complete and handles order creation with atomic ticket reservation, idempotency via userId + idempotencyKey, and proper error handling. The frontend concert detail page shows ticket selection and a summary, but the "Tiếp tục đặt vé" button only displays a confirmation message and does not call the API.

Current state:

- ConcertDetailPage maintains selection state: `Record<ticketTypeId, quantity>`
- TicketSelectionSummary displays summary and provides onContinue callback (unused)
- apiFetch utility in lib/api-client.ts already handles Authorization header from localStorage
- Router has /concerts and /concerts/:id but no /orders route

## Goals / Non-Goals

**Goals:**

- Enable authenticated users to create orders via POST /orders with selected tickets
- Provide secure submission with idempotency key generation on client
- Show loading/submitting state on button during API request
- Display pending order details (code, status, amount, expiry) on success
- Handle authentication errors (401) with inline message and login link
- Handle validation/inventory errors (400, 409) with backend messages
- Preserve ticket selections during error states (user can retry without re-selecting)
- Gracefully handle missing navigation state on direct URL access to /orders/:orderId

**Non-Goals:**

- Implement GET /orders/:id (use React Router navigation state for MVP)
- Implement payment flow or ticket issuance
- Implement order history page
- Implement cart persistence across sessions
- Add returnUrl redirect logic (future enhancement)

## Decisions

### 1. Idempotency Key Generation (Path A: Fresh Key Per Click)

**Decision:** Generate `idempotencyKey = crypto.randomUUID()` once inside `handleContinue`, before the API call. Do not store in React state.

**Rationale:**

- Prevents double-click submissions via immediate button disable (`setIsSubmitting(true)`)
- Each new user click = new order attempt with fresh UUID
- If API fails and user retries, that is a deliberate new order attempt (not a retry of the same submission)
- Aligns with user mental model: each click = separate action
- Simplifies state management (no submission key state needed)

**Alternatives considered:**

- Path B (store submissionKey in state for retry-safe behavior): More complex, less intuitive, requires storing key across error boundaries

### 2. Reuse Existing apiFetch for Authorization

**Decision:** Use existing `apiFetch<T>` utility for POST /orders call. No custom fetch wrapper.

**Rationale:**

- apiFetch already handles Authorization header from localStorage
- Consistent error handling and response parsing
- Reduces code duplication
- Enforces that token is always attached (security)

**Alternatives considered:**

- Custom fetch wrapper: Unnecessary duplication; apiFetch is already designed for this

### 3. Navigation State for OrderPendingPage (MVP)

**Decision:** Pass order response data via React Router `navigate(path, { state })` for MVP. If state is missing, show fallback message directing to /concerts.

**Rationale:**

- Fastest path to MVP; no need for GET /orders/:id backend endpoint
- Order data is already available post-creation, no re-fetch needed
- Fallback handles edge cases (direct URL, refresh, back from login)
- Navigation state is runtime-only (lost on refresh) which is acceptable for pending order display
- Future: Can add GET /orders/:id and migrate to persistent retrieval if needed

**Alternatives considered:**

- Add GET /orders/:id API: Out of scope for this change; adds backend work
- Store order in Redux/Context: Overkill for single-page display; state is sufficient

### 4. Error Handling Strategy

**Decision:** Handle 401/400/409 inline on ConcertDetailPage. Show error message and link/button to /login for 401. Show backend error message for 400/409. Clear error on retry.

**Rationale:**

- 401: User may have logged out; inline message + login link preserves ticket selections and lets user decide to login
- 400/409: Backend validation/inventory errors; show message and let user retry after reading message
- No auto-redirect maintains user agency and preserves page state
- Concert detail page and selections remain visible for context

**Alternatives considered:**

- Auto-redirect to /login on 401: Loses user context and selections
- Global error handler: Adds complexity; inline handling is sufficient for this feature

### 5. Feature Module Structure

**Decision:** Create `src/features/orders/` with:

- `api.ts`: `createOrder(request)` function using apiFetch
- `types.ts`: Request/response DTOs (CreateOrderRequest, CreateOrderResponse, CreateOrderItemRequest)
- `pages/OrderPendingPage.tsx`: Display order from navigation state or fallback
- No additional components (OrderPendingPage is standalone)

**Rationale:**

- Consistent with existing `features/auth/` and `features/concerts/` structure
- Keeps order-related code in one feature module
- Easy to extend later (add order history, order detail page, etc.)
- Clear separation of concerns

**Alternatives considered:**

- Add order creation logic to concerts feature: Mixes concerns; orders are a separate domain
- Single OrderComponent: Harder to test and extend

### 6. Button Disabled State Management

**Decision:** Use `isSubmitting` state in ConcertDetailPage. Disable button when `isSubmitting || totalQuantity === 0`.

**Rationale:**

- Prevents double-click during network request
- Clear visual feedback to user
- Preserves existing validation (no tickets selected)
- TicketSelectionSummary receives `isSubmitting` prop for conditional rendering

**Alternatives considered:**

- Disable only during submission, show spinner: Functional but more UI work
- Remove button during submission: Too drastic; user loses context

## Risks / Trade-offs

| Risk                                                                                                                                                                                                                                                | Mitigation                                                                                                                                                                   |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Network timeout during order creation**: User clicks again with new idempotencyKey, creating duplicate order attempt. Backend accepts it as new order (correct behavior); frontend doesn't prevent duplicate orders—backend does via idempotency. | This is intentional per Path A design. User can navigate back to concert and verify if needed. Future: Add confirmation dialog or retry toast if UX testing shows confusion. |
| **User refreshes /orders/:orderId page**: Navigation state is lost; page shows fallback message.                                                                                                                                                    | Acceptable for MVP. User can return to concert and recreate order if confirmation code is needed. Future: Implement GET /orders/:id to make page persistent.                 |
| **401 error occurs after user is logged in**: Token was in localStorage but backend rejected it (expired/revoked).                                                                                                                                  | User clicks login link, which may redirect to login (they're already logged in, so redirects back). Small UX friction. Future: Add token refresh + retry logic.              |
| **User has no token in localStorage**: apiFetch sends request without Authorization header; backend returns 401.                                                                                                                                    | Expected behavior. Error message guides user to login.                                                                                                                       |

## Migration Plan

1. Create `src/features/orders/` directory with api.ts, types.ts, pages/OrderPendingPage.tsx
2. Update ConcertDetailPage to import and call createOrder, add isSubmitting state, add error handling
3. Update TicketSelectionSummary to accept isSubmitting prop and disable button accordingly
4. Add /orders/:orderId route to router
5. Test end-to-end: concert detail → select tickets → click "Tiếp tục đặt vé" → API call → navigate to pending order page
6. Verify error handling: 401 (show message + link), 400/409 (show message)

No rollback needed; feature is purely additive and does not modify existing APIs or data models.

## Open Questions

1. **Confirmation dialog before order submission?** Currently no confirmation after clicking the button. Should we add "Bạn chắc chắn muốn đặt vé này?" modal, or is button click sufficient? (Deferred to design refinement)
2. **Spinner or loading text on button?** Button is disabled during submission; should we show spinner or "Đang xử lý..." text? (Deferred to UI/UX decision)
3. **Auto-logout on 401**: When token expires and user gets 401, should we clear localStorage and force re-login? (Out of scope; auth module handles this)
