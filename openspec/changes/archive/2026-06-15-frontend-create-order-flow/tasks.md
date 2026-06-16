## 1. Create Orders Feature Module Structure

- [ ] 1.1 Create directory `src/features/orders/`.
- [ ] 1.2 Create `src/features/orders/types.ts` with DTO types.
- [ ] 1.3 Create `src/features/orders/api.ts` with `createOrder()` function.
- [ ] 1.4 Create `src/features/orders/pages/` directory.
- [ ] 1.5 Create `src/features/orders/pages/OrderPendingPage.tsx` with happy path and fallback UI.

## 2. Implement Orders Types and API Client

- [ ] 2.1 In `types.ts`, define `CreateOrderItemRequest` with `ticketTypeId: string` and `quantity: number`.
- [ ] 2.2 In `types.ts`, define `CreateOrderRequest` with `concertId: string`, `idempotencyKey: string`, and `items: CreateOrderItemRequest[]`.
- [ ] 2.3 In `types.ts`, define `CreateOrderResponse` with `orderId: string`, `orderCode: string`, `status: "PENDING"`, `totalAmountVnd: number`, and `expiresAt: string`.
- [ ] 2.4 In `api.ts`, import the order types from `types.ts`.
- [ ] 2.5 In `api.ts`, implement `createOrder(request: CreateOrderRequest)` using existing `apiFetch<CreateOrderResponse>('/orders', { method: 'POST', body: JSON.stringify(request) })`.
- [ ] 2.6 Do not hard-code backend URL; rely on existing `apiFetch` / `VITE_API_BASE_URL` convention.

## 3. Implement OrderPendingPage

- [ ] 3.1 In `OrderPendingPage.tsx`, use `useLocation()` to read navigation state: `location.state?.order as CreateOrderResponse | undefined`.
- [ ] 3.2 Use `useNavigate()` for fallback navigation.
- [ ] 3.3 If order data exists, display `orderCode`, `status`, formatted `totalAmountVnd`, and formatted `expiresAt`.
- [ ] 3.4 Format `totalAmountVnd` as VND.
- [ ] 3.5 Format `expiresAt` in `vi-VN` timezone `Asia/Ho_Chi_Minh`.
- [ ] 3.6 If order data is missing, show: `Không có dữ liệu đơn hàng. Vui lòng quay lại danh sách sự kiện.`
- [ ] 3.7 Fallback button navigates to `/concerts`.
- [ ] 3.8 Do not implement `GET /orders/:id`.

## 4. Update Router

- [ ] 4.1 In `src/app/router.tsx`, import `OrderPendingPage`.
- [ ] 4.2 Add route `<Route path="/orders/:orderId" element={<OrderPendingPage />} />`.

## 5. Update ConcertDetailPage for Order Creation

- [ ] 5.1 In `ConcertDetailPage.tsx`, import `createOrder` from `src/features/orders/api`.
- [ ] 5.2 Import `useNavigate` from `react-router-dom` if not already imported.
- [ ] 5.3 Add `isSubmitting` state.
- [ ] 5.4 Add `submissionError` state for inline order creation errors.
- [ ] 5.5 Implement async `handleContinue`.
- [ ] 5.6 Inside `handleContinue`, generate `const idempotencyKey = crypto.randomUUID()` once as a local constant for that submit attempt.
- [ ] 5.7 Build `items` from selected quantities where `quantity > 0`; do not send zero-quantity items.
- [ ] 5.8 Set `isSubmitting` to true immediately before calling `createOrder`.
- [ ] 5.9 Call `createOrder({ concertId: id, idempotencyKey, items })`.
- [ ] 5.10 On success, navigate to `/orders/${response.orderId}` with React Router state: `{ order: response }`.
- [ ] 5.11 On error, set `submissionError` and reset `isSubmitting` to false.
- [ ] 5.12 If request fails and user clicks again, treat it as a new order attempt with a new idempotency key.
- [ ] 5.13 Do not store `submissionKey` in React state.
- [ ] 5.14 Do not implement global cart persistence.

## 6. Implement Order Creation Error Handling

- [ ] 6.1 For 401 errors, show inline message: `Vui lòng đăng nhập để đặt vé`.
- [ ] 6.2 For 401 errors, provide a link/button to `/login`.
- [ ] 6.3 Do not auto-redirect to login.
- [ ] 6.4 Do not implement `returnUrl`.
- [ ] 6.5 For 400 errors, show backend validation message.
- [ ] 6.6 For 409 errors, show backend conflict message with hint: `Vui lòng làm mới để xem tính khả dụng mới nhất.`
- [ ] 6.7 For other errors, show generic message: `Có lỗi xảy ra`.
- [ ] 6.8 Clear `submissionError` when the user changes ticket quantities.
- [ ] 6.9 Do not expect ticket selections to persist after navigating away to `/login`.

## 7. Update TicketSelectionSummary Component

- [ ] 7.1 Add `isSubmitting?: boolean` prop to `TicketSelectionSummaryProps`.
- [ ] 7.2 Disable continue button when `totalQuantity === 0` or `isSubmitting === true`.
- [ ] 7.3 Show submitting label `Đang tạo đơn...` while `isSubmitting` is true.
- [ ] 7.4 Pass `isSubmitting` from `ConcertDetailPage` to `TicketSelectionSummary`.

## 8. Styling

- [ ] 8.1 Add minimal styles for `OrderPendingPage` using existing CSS conventions.
- [ ] 8.2 Add minimal styles for submission error and login action if existing `Alert` / `Button` components are not enough.
- [ ] 8.3 Keep styling consistent with existing `styles.css` variables and page layout conventions.

## 9. Verification and Manual Testing

- [ ] 9.1 Run frontend validation commands if available:
  - `npm run typecheck`
  - `npm run lint`
  - `npm run build`

- [ ] 9.2 If any command is unavailable, record it as `script not available`; do not invent new scripts.
- [ ] 9.3 Verify `createOrder()` uses existing `apiFetch` and does not hard-code backend URL.
- [ ] 9.4 Verify no payment, ticket issuance, order history, `GET /orders/:id`, global cart persistence, `returnUrl`, or backend changes are implemented.

## 10. Local Test Setup

- [ ] 10.1 Ensure backend is running at `http://localhost:3000`.
- [ ] 10.2 Ensure frontend is running at the Vite dev URL, usually `http://localhost:5173`.
- [ ] 10.3 Use an existing registered user, or register/login through the current frontend/auth API if needed.
- [ ] 10.4 Verify `GET /concerts` returns at least one concert.
- [ ] 10.5 Verify `GET /concerts/:id/ticket-types` returns at least one ticket type with `availableQuantity > 0`.
- [ ] 10.6 Record the tested `concertId`, selected ticket type ids, and user email in the test summary.

## 11. Happy Path Test

- [ ] 11.1 Login successfully and confirm access token is stored according to the existing auth flow.
- [ ] 11.2 Navigate to `/concerts`.
- [ ] 11.3 Click a concert card and navigate to `/concerts/:id`.
- [ ] 11.4 Select at least one ticket quantity greater than 0.
- [ ] 11.5 Click `Tiếp tục đặt vé`.
- [ ] 11.6 Verify the button changes to `Đang tạo đơn...` and is disabled while submitting.
- [ ] 11.7 Verify exactly one `POST /orders` request is sent.
- [ ] 11.8 Verify request body contains:
  - `concertId`
  - `idempotencyKey`
  - `items`

- [ ] 11.9 Verify `items` contains only selected ticket types where quantity > 0.
- [ ] 11.10 Verify `idempotencyKey` is a valid UUID.
- [ ] 11.11 Verify response status is 200 and response contains:
  - `orderId`
  - `orderCode`
  - `status: "PENDING"`
  - `totalAmountVnd`
  - `expiresAt`

- [ ] 11.12 Verify frontend navigates to `/orders/:orderId`.
- [ ] 11.13 Verify `OrderPendingPage` displays order code, status, total amount formatted as VND, and expiry time formatted in `vi-VN` / `Asia/Ho_Chi_Minh`.

## 12. No Double Submit Test

- [ ] 12.1 Select a valid quantity.
- [ ] 12.2 Click `Tiếp tục đặt vé`.
- [ ] 12.3 Immediately try clicking the button again while the request is pending.
- [ ] 12.4 Verify only one `POST /orders` request is sent.
- [ ] 12.5 Verify button is disabled during submission.
- [ ] 12.6 Verify button re-enables if the request fails.
- [ ] 12.7 Verify successful request navigates away to `/orders/:orderId`.

## 13. Idempotency Key Test

- [ ] 13.1 Submit one successful order and inspect the `POST /orders` request body.
- [ ] 13.2 Verify `idempotencyKey` exists and is a valid UUID.
- [ ] 13.3 Navigate back to the concert page and submit a new order attempt.
- [ ] 13.4 Verify the new request uses a different `idempotencyKey`.
- [ ] 13.5 Verify the app does not store `submissionKey` in React state or global storage.

## 14. 401 Authentication Error Test

- [ ] 14.1 Remove or clear the stored access token using the current auth storage convention.
- [ ] 14.2 Stay on `/concerts/:id`, select tickets, and click `Tiếp tục đặt vé`.
- [ ] 14.3 Verify `POST /orders` returns 401.
- [ ] 14.4 Verify inline message appears: `Vui lòng đăng nhập để đặt vé`.
- [ ] 14.5 Verify a link/button to `/login` appears.
- [ ] 14.6 Verify the app does not auto-redirect to `/login`.
- [ ] 14.7 Verify no `returnUrl` logic is implemented.
- [ ] 14.8 Do not expect selections to persist after navigating away to `/login`.

## 15. 400 Validation Error Test

- [ ] 15.1 Trigger a 400 naturally from frontend if possible, without editing backend code.
- [ ] 15.2 If a natural 400 cannot be triggered through valid UI controls, record this test as blocked.
- [ ] 15.3 Do not modify backend code to force a 400.
- [ ] 15.4 If 400 occurs, verify backend validation message is shown inline.
- [ ] 15.5 Verify submit button is enabled again after the error.

## 16. 409 Conflict Error Test

- [ ] 16.1 Trigger a 409 naturally if possible, such as by selecting quantity that violates per-user limit or stale availability.
- [ ] 16.2 If the UI prevents selecting invalid quantity and no natural 409 can be triggered, record this test as blocked.
- [ ] 16.3 Do not modify backend code to force a 409.
- [ ] 16.4 If 409 occurs, verify backend conflict message is shown inline.
- [ ] 16.5 Verify hint appears: `Vui lòng làm mới để xem tính khả dụng mới nhất.`
- [ ] 16.6 Verify submit button is enabled again after the error.

## 17. OrderPendingPage Fallback Test

- [ ] 17.1 Open `/orders/fake-id-123` directly in the browser without navigating from order creation.
- [ ] 17.2 Verify fallback message appears: `Không có dữ liệu đơn hàng. Vui lòng quay lại danh sách sự kiện.`
- [ ] 17.3 Click fallback button.
- [ ] 17.4 Verify it navigates to `/concerts`.
- [ ] 17.5 Verify no `GET /orders/:id` request is made.

## 18. Items Filtering Test

- [ ] 18.1 Select quantities for multiple ticket types if available.
- [ ] 18.2 Leave at least one visible ticket type at quantity 0.
- [ ] 18.3 Submit the order.
- [ ] 18.4 Inspect `POST /orders` request body.
- [ ] 18.5 Verify `items` includes only ticket types with quantity > 0.
- [ ] 18.6 Verify zero-quantity ticket types are not sent.

## 19. Error Clear Test

- [ ] 19.1 Trigger a submission error.
- [ ] 19.2 Verify the error message appears.
- [ ] 19.3 Change any ticket quantity using plus/minus controls.
- [ ] 19.4 Verify `submissionError` clears from the UI.
- [ ] 19.5 Verify user can attempt submission again.

## 20. Final Test Report

- [ ] 20.1 Provide a final test report in chat with this format:

### Commands Run

- ...

### Test Data

- User email:
- Concert ID:
- Ticket Type IDs:
- Order ID created:

### Passed

- ...

### Failed

- ...

### Blocked / Not Tested

- ...

### Notes

- ...

- [ ] 20.2 If any test fails, do not silently fix it unless explicitly asked.

- [ ] 20.3 If fixes are required, explain the issue, expected behavior, actual behavior, and suggested fix.
