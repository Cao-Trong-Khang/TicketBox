## Specification: Create Order Flow

## Description

Authenticated audience members can create orders for concert tickets directly from the concert detail page UI. After selecting ticket quantities and clicking the "Tiếp tục đặt vé" (Continue to Order) button, the frontend calls POST /orders to create a pending order with atomic ticket reservation. The response displays order code, status, total amount, and expiry time on a pending order page. The system handles validation errors (400), inventory errors (409), and authentication errors (401) with user-friendly messages.

## Main Flow

**Primary Success Path: Create Order**

1. User is authenticated and viewing concert detail page (ConcertDetailPage)
2. User selects ticket quantities for one or more ticket types (selections state > 0)
3. User clicks "Tiếp tục đặt vé" (Continue to Order) button
4. Frontend generates fresh idempotencyKey (UUID)
5. Frontend builds CreateOrderRequest with concertId, idempotencyKey, and items (only quantity > 0)
6. Frontend calls POST /orders with request via apiFetch (Authorization header auto-included)
7. Backend validates concert exists and is published
8. Backend validates each ticket type exists and is on sale
9. Backend validates selected quantities do not exceed per-user limits
10. Backend atomically reserves tickets and creates order + order items in PostgreSQL
11. Backend invalidates ticket-types cache in Redis (fire-and-forget)
12. Backend returns 200 with CreateOrderResponse (orderId, orderCode, status: PENDING, totalAmountVnd, expiresAt)
13. Frontend receives response and navigates to /orders/{orderId} with { state: { order } }
14. OrderPendingPage displays order code, status (PENDING), formatted amount, and expiry datetime

## Failure Scenarios

### Scenario 1: Unauthenticated User

- **WHEN** user without valid JWT attempts POST /orders
- **THEN** backend returns 401 Unauthorized
- **Frontend** shows inline error message: "Vui lòng đăng nhập để đặt vé"
- **Frontend** displays link to /login page
- **Frontend** does NOT auto-redirect; user preserves ticket selections on concert detail page
- **Frontend** clears isSubmitting state, button becomes enabled for retry

### Scenario 2: Insufficient Ticket Inventory

- **WHEN** user selects quantities that exceed available stock (total_quantity - reserved_quantity - sold_quantity)
- **THEN** backend POST /orders returns 409 Conflict
- **Frontend** shows inline error message with backend error details (e.g., "Số lượng vé vượt quá giới hạn cho người dùng")
- **Frontend** suggests user refresh ticket availability (backend will have updated availableQuantity on GET /concerts/:id)
- **Frontend** clears isSubmitting state, button becomes enabled for retry

### Scenario 3: Per-User Purchase Limit Exceeded

- **WHEN** user has pending or paid orders with tickets of same type that, combined with current selection, exceed perUserLimit
- **THEN** backend POST /orders returns 409 Conflict
- **Frontend** shows inline error message with backend error
- **Frontend** button becomes enabled; user can modify selections and retry

### Scenario 4: Concert Not Found or Not Published

- **WHEN** concertId does not exist OR concert status is not PUBLISHED
- **THEN** backend POST /orders returns 400 Bad Request
- **Frontend** shows inline error message with backend error details
- **Frontend** button becomes enabled; user can go back to concert list

### Scenario 5: Ticket Type Not Found or Not Active

- **WHEN** ticketTypeId does not exist OR ticket type status is INACTIVE or outside sale windows
- **THEN** backend POST /orders returns 400 Bad Request
- **Frontend** shows inline error message
- **Frontend** button becomes enabled; user can refresh concert detail page

### Scenario 6: Idempotent Retry - Same User, Same Key

- **WHEN** user submits order with idempotencyKey K1, network times out (no response)
- **WHEN** user submits again with same idempotencyKey K1
- **THEN** backend returns existing order instead of creating duplicate (userId + idempotencyKey unique constraint)
- **Frontend** navigates to existing /orders/{orderId} with same order data

### Scenario 7: Double-Click Prevention

- **WHEN** user clicks button twice in rapid succession
- **THEN** frontend sets isSubmitting(true) immediately after first click
- **THEN** button is disabled; second click has no effect
- **THEN** only one POST /orders request is sent

### Scenario 8: Direct URL Access to /orders/:orderId

- **WHEN** user opens /orders/:orderId directly (e.g., from browser history or manual URL)
- **WHEN** navigation state is missing (not coming from CREATE order flow)
- **THEN** OrderPendingPage shows fallback message: "Không có dữ liệu đơn hàng. Vui lòng quay lại danh sách sự kiện."
- **THEN** displays button linking to /concerts (concert list)
- **THEN** does NOT attempt GET /orders/:id lookup (out of scope)

### Scenario 9: Ticket Selection Empty or Changed

- **WHEN** user selects 0 tickets
- **THEN** button is disabled (totalQuantity === 0 check)
- **WHEN** user modifies selections after error, clearing all quantities
- **THEN** button becomes disabled again

## Constraints

1. **Authentication**: POST /orders requires valid JWT in Authorization header. Frontend MUST retrieve token from localStorage.
2. **Idempotency**: Frontend MUST generate fresh UUID per click/submit attempt. Each click is a distinct order attempt (not a retry of previous). Backend ensures userId + idempotencyKey uniqueness prevents duplicate orders.
3. **Double-Click Prevention**: Button MUST be disabled immediately (setIsSubmitting(true)) during request. No submissions after first click until request completes or errors.
4. **Authorization**: Only authenticated users (with valid JWT) can create orders. No guest checkouts.
5. **Inventory Atomicity**: Ticket reservation MUST be atomic with order/order-item creation. Either all-or-nothing in PostgreSQL transaction.
6. **Cache Invalidation**: Backend MUST invalidate Redis ticket-types cache post-commit to ensure stale data does not propagate.
7. **Error Transparency**: Frontend MUST display backend error messages (from response.message field) to user for 400/409 responses. Generic fallback only if no message.
8. **Navigation State**: OrderPendingPage MUST gracefully handle missing navigation state (runtime-only in MVP). MUST NOT attempt GET /orders/:id.
9. **No Payment Processing**: This specification does NOT include payment flow, ticket issuance, or order fulfillment. Order remains PENDING indefinitely until external payment/fulfillment system advances it.

## Acceptance Criteria

### Test Case 1: Successful Order Creation

- **GIVEN** authenticated user on concert detail page with tickets selected
- **WHEN** user clicks "Tiếp tục đặt vé"
- **THEN** frontend calls POST /orders with correct request structure
- **AND** response received with orderId, orderCode, status=PENDING, totalAmountVnd, expiresAt
- **AND** user navigates to /orders/{orderId}
- **AND** OrderPendingPage displays order code, PENDING status, amount, and expiry

### Test Case 2: 401 Unauthorized Handling

- **GIVEN** user without valid token (localStorage.accessToken is empty/invalid)
- **WHEN** user attempts to create order
- **THEN** POST /orders returns 401
- **AND** frontend shows "Vui lòng đăng nhập để đặt vé" message
- **AND** frontend displays link to /login
- **AND** user remains on concert detail page with selections intact

### Test Case 3: 400 Validation Error Handling

- **GIVEN** user selects invalid ticket type or concert is not published
- **WHEN** user clicks order button
- **THEN** POST /orders returns 400 with error message
- **AND** frontend displays error message inline
- **AND** button becomes enabled for user to modify or retry

### Test Case 4: 409 Inventory Error Handling

- **GIVEN** available ticket inventory is insufficient
- **WHEN** user attempts to create order
- **THEN** POST /orders returns 409 with error message
- **AND** frontend shows error message with hint about refreshing availability
- **AND** button enabled; user can reduce quantities and retry

### Test Case 5: Idempotency

- **GIVEN** user creates order with tickets, network timeout occurs
- **WHEN** user clicks button again (with new idempotencyKey)
- **THEN** system treats as new order attempt (not retry of same order)
- **AND** if sufficient inventory, a second order is created with different orderId

### Test Case 6: Button Disabled During Submission

- **GIVEN** user on concert detail with selections
- **WHEN** user clicks button
- **THEN** button immediately becomes disabled (gray/inactive appearance)
- **AND** no second request sent if user clicks again rapidly
- **AND** button re-enabled after request completes (success or error)

### Test Case 7: OrderPendingPage Fallback

- **GIVEN** user opens /orders/:orderId URL directly without navigation state
- **WHEN** page loads
- **THEN** fallback message displays: "Không có dữ liệu đơn hàng. Vui lòng quay lại danh sách sự kiện."
- **AND** button to /concerts is present and functional

### Test Case 8: Items Filtering (Only Qty > 0)

- **GIVEN** user selects: TicketType-A qty=2, TicketType-B qty=0, TicketType-C qty=1
- **WHEN** user clicks order button
- **THEN** request sent with items array containing only [TicketType-A, TicketType-C]
- **AND** TicketType-B (qty=0) is NOT included in request

### Test Case 9: Loading/Submitting State

- **GIVEN** user clicks order button
- **WHEN** request is in flight
- **THEN** frontend shows isSubmitting visual feedback (disabled button state minimum)
- **AND** user cannot interact with button

### Test Case 10: Error Clears on Retry

- **GIVEN** order creation failed with error message displayed
- **WHEN** user modifies selections and clicks button again
- **THEN** previous error message cleared
- **AND** new request sent with new idempotencyKey
