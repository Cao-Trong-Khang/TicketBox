## Why

Users viewing concert details can see ticket types and availability, but have no way to select quantities or begin the booking process. The concert detail page currently displays ticket information as read-only, creating a gap in the user journey from browsing to checkout. This change enables users to specify ticket quantities they want to purchase, providing essential functionality for the order placement workflow.

## What Changes

- Add interactive quantity selector to each ticket type on `/concerts/:id` detail page with minus/plus buttons (quantity starts at 0)
- Enforce selection constraints: quantity ≥ 0, ≤ availableQuantity, and ≤ perUserLimit
- Display "Hết vé" (sold out) state for unavailable tickets with disabled quantity controls
- Add ticket selection summary below the ticket list showing:
  - Selected ticket types with individual quantities, unit prices, and line totals
  - Total selected quantity and total amount in VND
- Add "Tiếp tục đặt vé" (Continue booking) button that is disabled when no tickets selected
- Show inline UI message when button is clicked: "Tạo đơn hàng sẽ được triển khai ở bước tiếp theo." (Order creation will be implemented in the next phase)
- Refactor TicketTypeCard from display-only to controlled component accepting quantity state and handlers
- Create new TicketSelectionSummary component for summary display and continue action

**Not included**: Order creation (POST /orders), checkout/payment processing, user authentication checks, or selection persistence across page reloads.

## Capabilities

### New Capabilities

- `ticket-quantity-selection`: Enables users to select ticket quantities per ticket type on the concert detail page with real-time validation against availability and per-user limits, display of selection summary, and proceed-to-checkout UI.

### Modified Capabilities

- None - no existing spec-level requirement changes.

## Impact

**Frontend**: ConcertDetailPage component refactored to own selection state and pass controlled props to TicketTypeCard. New TicketSelectionSummary component introduced. styles.css extended with quantity selector and summary styling (~150 lines).

**Components affected**:

- `frontend/src/features/concerts/pages/ConcertDetailPage.tsx` - adds selection state, handlers, computed totals
- `frontend/src/features/concerts/components/TicketTypeCard.tsx` - refactored to controlled component with ±buttons
- `frontend/src/features/concerts/components/TicketSelectionSummary.tsx` - new component for summary and continue button
- `frontend/src/styles.css` - add CSS classes for quantity selector, summary styling, and responsive layout

**API**: No backend changes. Existing GET /concerts/:id and GET /concerts/:id/ticket-types used unchanged.

**Database**: No changes.

**User roles affected**: Audience (concert attendees) - enables ticket selection capability before checkout.

**External systems**: None.

**Related to global goals**: Supports the global checkout-related feature goal (prevent overselling, enforce per-user limits). Enforces availableQuantity and perUserLimit constraints. Does not reach actual order creation or payment processing.
