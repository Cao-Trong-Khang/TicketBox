## Specification: Ticket Quantity Selection

## Description

This feature enables audience members viewing a concert detail page to select ticket quantities for different ticket types before proceeding to order creation. Users can increment or decrement quantities using +/- buttons, with visual feedback showing selection summary and total price. The feature enforces business rules around availability and per-user purchase limits. The Web Application displays the quantity selector as a controlled component receiving state from the frontend React application (no backend changes).

## Main Flow

1. **User navigates to concert detail** (`/concerts/:id`)
   - Web Application fetches concert details via `GET /concerts/:id`
   - Web Application fetches ticket types via `GET /concerts/:id/ticket-types`
   - Ticket types render in a list with availability indicators

2. **User interacts with quantity selector**
   - For each ticket type, a quantity selector with minus/plus buttons is displayed
   - User clicks plus button to increment (if within limits) or minus to decrement (if > 0)
   - Web Application updates local React state immediately (no API call)
   - Selection constraint validation happens in-memory: quantity cannot exceed Math.min(availableQuantity, perUserLimit)

3. **Selection summary updates in real-time**
   - Web Application computes: total selected quantity, total amount in VND
   - Web Application displays list of selected ticket types with quantity, unit price, and line total
   - Summary only shows ticket types with quantity > 0

4. **User clicks continue button**
   - "Tiếp tục đặt vé" button is only enabled when total selected quantity > 0
   - User clicks button
   - Web Application displays inline message: "Tạo đơn hàng sẽ được triển khai ở bước tiếp theo."
   - No order is created; feature ends here pending future checkout implementation

## Failure Scenarios

- **Sold-out ticket type**: If availableQuantity === 0, quantity selector is disabled and "Hết vé" badge is shown. User cannot increment quantity.
- **Per-user limit exceeded**: If user attempts to set quantity > perUserLimit, quantity caps at perUserLimit silently (button becomes disabled).
- **Availability limit exceeded**: If user attempts to set quantity > availableQuantity, quantity caps at availableQuantity silently (button becomes disabled).
- **Page refresh/reload**: Selection state is lost (no persistence in this MVP). User would need to re-select quantities.
- **Concert detail fails to load**: Error state displays with retry option. Quantity selector not shown until retry succeeds.
- **Ticket types list is empty**: "Chưa có hạng vé đang mở bán." message shown. Continue button remains disabled.

## Constraints

- **No persistence**: Selection state exists only in memory (React component state). No local storage, session storage, or backend tracking.
- **No order creation**: Clicking continue does not call `POST /orders`. Feature is UI-only selection and summary.
- **No authentication checks**: Feature does not verify user identity or check user's purchase history limits (future phase).
- **No payment processing**: Feature does not interact with payment gateway or charge user.
- **Real-time validation**: Quantity limits enforced synchronously in JavaScript; no server-side validation for this MVP.
- **Display-only availability**: availableQuantity shown to user is snapshot from initial API fetch. Concurrent purchases by other users are not reflected in real-time.
- **MVP constraints**: No text input field for quantity (±buttons only), no sticky footer (summary flows with content), no undo/clear-all actions.

## Acceptance Criteria

**AC1: Quantity selector renders for each ticket type**

- GIVEN user is on concert detail page with available ticket types
- WHEN page finishes loading
- THEN each ticket type displays a quantity selector with minus button, quantity display (starting at 0), and plus button

**AC2: Plus button increments quantity**

- GIVEN quantity selector with current quantity < Math.min(availableQuantity, perUserLimit)
- WHEN user clicks plus button
- THEN quantity increments by 1 and summary updates

**AC3: Plus button is disabled at max**

- GIVEN quantity has reached Math.min(availableQuantity, perUserLimit)
- WHEN user attempts to click plus button
- THEN button is visually disabled and quantity does not increment

**AC4: Minus button decrements quantity**

- GIVEN quantity selector with current quantity > 0
- WHEN user clicks minus button
- THEN quantity decrements by 1 and summary updates

**AC5: Minus button is disabled at zero**

- GIVEN quantity selector with current quantity = 0
- WHEN user attempts to click minus button
- THEN button is visually disabled and quantity does not decrement

**AC6: Sold-out tickets are disabled**

- GIVEN ticket type with availableQuantity === 0
- WHEN page renders
- THEN "Hết vé" badge displays, quantity selector is completely disabled (all buttons disabled), and plus/minus buttons cannot be clicked

**AC7: Selection summary displays selected items**

- GIVEN user has selected quantities for one or more ticket types
- WHEN summary section renders
- THEN selected items are listed showing: ticket type name, quantity, unit price (formatted VND), and line total (quantity × price, formatted VND)

**AC8: Selection summary shows totals**

- GIVEN user has selected quantities
- WHEN summary section renders
- THEN total selected quantity and total amount (formatted in VND) are displayed

**AC9: Empty selection shows placeholder**

- GIVEN no tickets have been selected (all quantities are 0)
- WHEN summary section renders
- THEN "Chưa chọn vé nào" message displays (no items list)

**AC10: Continue button is disabled when no selection**

- GIVEN total selected quantity = 0
- WHEN page renders
- THEN "Tiếp tục đặt vé" button is visually disabled and not clickable

**AC11: Continue button is enabled with selection**

- GIVEN total selected quantity > 0
- WHEN user views continue button
- THEN button is enabled and clickable

**AC12: Continue button shows temporary message**

- GIVEN user has selected ticket quantities
- WHEN user clicks enabled "Tiếp tục đặt vé" button
- THEN inline success message displays: "Tạo đơn hàng sẽ được triển khai ở bước tiếp theo."

**AC13: Price formatting is consistent**

- GIVEN ticket prices and totals are displayed
- WHEN summary renders
- THEN all prices use formatVnd() function (e.g., "800.000 ₫", not "Từ 800.000 ₫")

**AC14: Responsive layout on mobile/tablet/desktop**

- GIVEN user is on concert detail page
- WHEN viewing on mobile (<768px), tablet (768-1023px), or desktop (≥1024px)
- THEN ticket types and summary display readably with appropriate spacing and alignment

**AC15: No API calls during selection**

- GIVEN user is selecting ticket quantities
- WHEN clicking +/- buttons and viewing summary
- THEN no HTTP requests are made (selection is client-only)
