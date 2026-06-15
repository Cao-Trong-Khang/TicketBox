## 1. Component Types & Local State Setup

- [x] 1.1 In ConcertDetailPage.tsx, define SelectionState type locally (not exported): `type SelectionState = Record<string, number>` representing {ticketTypeId: quantity}.
- [x] 1.2 In ConcertDetailPage.tsx, add state for selections: `const [selections, setSelections] = useState<SelectionState>({})` initializing empty record.
- [x] 1.3 In ConcertDetailPage.tsx, add state for continue message: `const [showContinueMessage, setShowContinueMessage] = useState(false)` for inline UI feedback.
- [x] 1.4 Run `npm run typecheck` to verify types are correct and no errors exist.

## 2. Handler Functions in ConcertDetailPage

- [x] 2.1 Implement `handleIncrease(ticketTypeId: string)` handler: increment quantity, enforce max = Math.min(availableQuantity, perUserLimit), silently cap if at limit, update state.
- [x] 2.2 Implement `handleDecrease(ticketTypeId: string)` handler: decrement quantity, enforce min = 0, silently cap if at 0, update state.
- [x] 2.3 Implement `handleContinue()` handler: set showContinueMessage to true, auto-dismiss after 3-4 seconds via setTimeout.
- [x] 2.4 Implement `getSelectedItems()` computed function: filter ticketTypes where selections[id] > 0, map to {ticketType, quantity, lineTotal}.
- [x] 2.5 Implement `getTotalQuantity()`: sum of all selections values.
- [x] 2.6 Implement `getTotalAmount()`: sum of (ticketType.priceVnd × selections[id]) for selected items.
- [x] 2.7 Run `npm run typecheck` to verify all handlers compile without errors.

## 3. Refactor TicketTypeCard Component

- [x] 3.1 Update TicketTypeCard props: add `quantity: number`, `onIncrease: () => void`, `onDecrease: () => void` to type definition.
- [x] 3.2 Update TicketTypeCard to receive and use new props in render.
- [x] 3.3 In TicketTypeCard render: replace disabled "Chọn vé" button with quantity selector bar: minus button (disabled if qty === 0) | quantity display (center) | plus button (disabled if qty === maxQty).
- [x] 3.4 For sold-out tickets (availableQuantity === 0): disable all quantity buttons, show "Hết vé" badge, render entire selector as disabled state (greyed out).
- [x] 3.5 Compute maxQty = Math.min(availableQuantity, perUserLimit) inside TicketTypeCard to determine plus button disabled state.
- [x] 3.6 Verify TicketTypeCard compiles with `npm run typecheck`.

## 4. Create TicketSelectionSummary Component

- [x] 4.1 Create new file `frontend/src/features/concerts/components/TicketSelectionSummary.tsx`.
- [x] 4.2 Define component props: `selectedItems`, `totalQuantity`, `totalAmount`, `onContinue` callback.
- [x] 4.3 Render summary section with header "CHI TIẾT ĐẶT VÉ".
- [x] 4.4 If selectedItems.length === 0: render "Chưa chọn vé nào" message, disable continue button.
- [x] 4.5 If selectedItems.length > 0: render table/list of selected items, each row showing: ticket name, quantity, unit price (formatVnd), line total (formatVnd).
- [x] 4.6 Render totals row: "Tổng: {totalQuantity} vé" + "{formatVnd(totalAmount)}".
- [x] 4.7 Render "Tiếp tục đặt vé" button: enabled when totalQuantity > 0, disabled otherwise, onClick calls onContinue handler.
- [x] 4.8 Verify TicketSelectionSummary compiles with `npm run typecheck`.

## 5. Update ConcertDetailPage Render & Integration

- [x] 5.1 In ConcertDetailPage render, update each TicketTypeCard to pass: quantity={selections[ticketType.id] ?? 0}, onIncrease={() => handleIncrease(ticketType.id)}, onDecrease={() => handleDecrease(ticketType.id)}.
- [x] 5.2 After ticket types list, render conditional inline message: {showContinueMessage && <Alert tone="success">Tạo đơn hàng sẽ được triển khai ở bước tiếp theo.</Alert>}.
- [x] 5.3 After ticket types list, render TicketSelectionSummary with: selectedItems={getSelectedItems()}, totalQuantity={getTotalQuantity()}, totalAmount={getTotalAmount()}, onContinue={handleContinue}.
- [x] 5.4 Import TicketSelectionSummary at top of ConcertDetailPage.tsx.
- [x] 5.5 Verify ConcertDetailPage compiles and renders correctly with `npm run typecheck`.

## 6. Add CSS Styling for Quantity Selector & Summary

- [x] 6.1 Add `.ticket-quantity-selector` class: flex container for minus button, qty display, plus button; center alignment; horizontal layout.
- [x] 6.2 Add `.ticket-qty-button` class: styling for minus/plus buttons (smaller size, padding, border, background color, hover state, disabled state (greyed out, cursor not-allowed)).
- [x] 6.3 Add `.ticket-qty-display` class: center text display of current quantity (font-weight bold, min-width to avoid reflow).
- [x] 6.4 Add `.ticket-selection-summary` class: section container (padding, border, background, rounded corners using design system variables).
- [x] 6.5 Add `.summary-item` class: row for each selected ticket (flex, space-between, padding, borders if needed).
- [x] 6.6 Add `.summary-total` class: styling for total row (font-weight bold, larger text, separator line if desired).
- [x] 6.7 Add `.summary-continue-button` class: styling for continue button (full-width or auto, padding, margin-top).
- [x] 6.8 Update `.ticket-type-card` grid layout (if using grid): ensure minus/plus buttons and qty display fit where old button was (may need grid-template-columns adjustment on tablet/desktop breakpoints).
- [x] 6.9 Ensure responsive behavior: mobile (<768px) stacks naturally, tablet/desktop (≥768px) layout adapts cleanly (reuse existing breakpoints).
- [x] 6.10 Use CSS design system variables: --accent, --muted, --danger (for sold-out), --surface, --line, --shadow, etc.
- [x] 6.11 Run `npm run lint` to verify CSS has no errors.

## 7. Verification & Code Quality

- [x] 7.1 Run `npm run typecheck` - all TypeScript errors resolved.
- [x] 7.2 Run `npm run lint` - all ESLint warnings/errors resolved.
- [x] 7.3 Run `npm run build` - production build succeeds without errors or warnings.
- [x] 7.4 Verify no hard-coded backend URLs in component code; all API calls use existing `apiFetch` and `VITE_API_BASE_URL`.
- [x] 7.5 Verify no console errors logged during development (`npm run dev`).
- [x] 7.6 Check that TicketTypeCard and TicketSelectionSummary are properly exported and imported.
