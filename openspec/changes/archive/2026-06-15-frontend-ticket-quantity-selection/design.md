## Context

The concert detail page (`/concerts/:id`) currently displays ticket types in a read-only format. Users can view ticket information but cannot specify quantities to purchase. This blocks the user journey from browsing to checkout. The Web Application (React frontend) fetches concert details and ticket types via existing REST APIs (`GET /concerts/:id`, `GET /concerts/:id/ticket-types`) and must now add interactive selection UI on the detail page.

This is a frontend-only feature: no backend API changes, no database schema changes, and no new external dependencies. All selection state exists in React component state (ephemeral, client-side only). No persistence, no order creation, no payment processing in this MVP.

## Goals / Non-Goals

**Goals:**

- Enable users to select ticket quantities on the concert detail page with validated constraints (availability, per-user limits)
- Display a real-time summary of selected tickets with total quantity and total price
- Provide a "Continue" button to signal readiness for checkout (display-only; no order creation)
- Maintain responsive, accessible UI across mobile, tablet, and desktop viewports
- Reuse existing frontend patterns: formatVnd() price formatter, Alert component, Button component, CSS design system variables

**Non-Goals:**

- Backend API changes (no new endpoints, no availability updates)
- Order creation (POST /orders)
- Checkout, payment gateway integration, or payment processing
- User authentication or purchase limit enforcement (existing user context not checked in this MVP)
- Selection persistence (local storage, session storage, or backend tracking)
- Real-time availability updates (concurrent purchases by other users are not reflected)
- Text input for quantity (±buttons only in this MVP)
- Sticky footer or side panel for summary (flows with content)
- Seat-level booking or venue layout interaction

## Decisions

### Decision 1: State Ownership - ConcertDetailPage Owns All Selections

**Choice**: ConcertDetailPage component holds selection state as a single Record<ticketTypeId, quantity>.

**Rationale**: Single source of truth simplifies computing totals, avoids prop-drilling callbacks, and makes it easier to add features later (e.g., "clear all", "save for later"). ConcertDetailPage is the natural orchestrator; it already manages concert detail and ticket types state.

**Alternatives**:

- Each TicketTypeCard manages its own quantity: Would require callback chains to update summary. More complex for totals computation and harder to add global actions.
- Custom Hook (useTicketSelection): Over-abstraction for current scope. Revisit if multiple pages need this logic.

### Decision 2: TicketTypeCard Refactored to Controlled Component

**Choice**: TicketTypeCard receives props: quantity (number), onIncrease (callback), onDecrease (callback). Component is purely presentational and does not manage its own state.

**Rationale**: Controlled components are predictable and follow React best practices. Parent (ConcertDetailPage) enforces all validation logic (max quantity checks, boundary conditions). Card rendering is decoupled from selection logic.

**Alternatives**:

- Uncontrolled component (TicketTypeCard manages quantity internally): Loss of parent visibility into total selections. Difficult to update summary in real-time.
- Pass entire selection object down: Brittle prop passing; harder to refactor incrementally.

### Decision 3: New TicketSelectionSummary Component

**Choice**: Create a separate component to render the selection summary (selected items list, totals, continue button).

**Rationale**: Keeps ConcertDetailPage render logic readable. TicketSelectionSummary encapsulates summary-specific styling and layout. Easier to enhance in future (e.g., edit item quantities, apply discounts).

**Alternatives**:

- Inline summary in ConcertDetailPage render: ConcertDetailPage becomes too large. Harder to maintain.

### Decision 4: Quantity Controls - Plus/Minus Buttons Only

**Choice**: Provide two buttons (−/+) to change quantity. No text input field.

**Rationale**: Simpler UX for MVP, aligns with constraints (availableQuantity and perUserLimit). Button states clearly signal boundaries. Text input would require validation logic and error messages; can be added later.

**Alternatives**:

- Include text input field: More complex; users could type invalid values requiring error handling.
- Slider control: Overkill for ticket selection; button interface is more familiar.

### Decision 5: Validation Enforcement - Math.min(availableQuantity, perUserLimit)

**Choice**: Client-side JavaScript enforces quantity cap = Math.min(ticketType.availableQuantity, ticketType.perUserLimit). Plus button becomes disabled when quantity reaches this cap.

**Rationale**: MVP skips backend validation (no new API endpoint). Constraints are known upfront from the ticket type object. Synchronous validation gives instant feedback.

**Alternatives**:

- No client-side cap, rely on future server validation: Degrades UX (no button feedback). Allows invalid selections.
- Cache and server-side validation: Adds API overhead and backend work out of scope for this MVP.

### Decision 6: Selection State - Local/Ephemeral Only

**Choice**: Selections exist only in React component state (Record<string, number>). No persistence to localStorage, sessionStorage, or backend.

**Rationale**: Simplifies MVP scope. Users complete selection → proceed → checkout flow in one session. Page refresh resets selections (acceptable for now). Future phases can add persistence if needed.

**Alternatives**:

- localStorage persistence: Adds complexity (serialization, hydration), unclear UX for expired caches, introduces stale data bugs.
- Backend persistence (track partial selections): Requires new DB table, API endpoints, session management—beyond this MVP scope.

### Decision 7: Summary Display - Below Ticket List, Not Sticky

**Choice**: Summary renders as a normal page element below the ticket types list. No sticky footer or side panel.

**Rationale**: Simpler CSS and layout logic. Flows naturally with page content. Sufficient for MVP; can add sticky patterns later if UX testing shows users scroll away and need visible CTA.

**Alternatives**:

- Sticky footer: Adds CSS complexity, potential z-index issues, mobile viewport crowding.
- Side panel: Requires major layout restructure.

### Decision 8: Continue Button Behavior - Inline Message, No Alert

**Choice**: On click, display an inline success Alert component with message "Tạo đơn hàng sẽ được triển khai ở bước tiếp theo." Message auto-dismisses after ~3-4 seconds.

**Rationale**: Native browser alerts are jarring and block interactivity. Inline Alert integrates with existing TicketBox Alert component and design system. Auto-dismiss keeps flow smooth.

**Alternatives**:

- browser alert(): Blocks, poor UX.
- Modal dialog: Over-engineered for a simple message.
- Toast notification: Could work, but App likely lacks toast infrastructure; Alert is available and sufficient.

### Decision 9: Quantity Selector UI Position - Replace Disabled Button

**Choice**: In TicketTypeCard, replace the existing disabled "Chọn vé" button with a quantity control bar (− button, qty display, + button).

**Rationale**: Reuses existing button space. Visual hierarchy clear. No CSS reflow surprises.

**Alternatives**:

- Add selector in a new row below button: Adds vertical bulk to cards, harder to scan quickly.
- Inline next to button: Cramped, misaligned.

### Decision 10: Sold-Out State - Disable Entire Selector

**Choice**: When availableQuantity === 0, display "Hết vé" badge and disable all quantity buttons (−, +, display is greyed out).

**Rationale**: Matches existing display-only design pattern (sold-out state already shows "Hết vé"). Users cannot interact with unavailable inventory. Consistent with spec requirement.

**Alternatives**:

- Show selector but disabled: Confusing UX (control appears interactive but fails).
- Hide selector entirely: Inconsistent card layout.

### Decision 11: Price Formatting - formatVnd() for Line Totals

**Choice**: Use existing formatVnd(price) function for ticket unit prices and line totals in summary. This outputs e.g., "800.000 ₫" (exact price, not "Từ 800.000 ₫").

**Rationale**: Consistent with concert list page formatPrice() pattern (which uses "Từ" prefix for minimum prices). formatVnd() is already defined in the codebase and provides exact pricing suitable for summary context.

**Alternatives**:

- Implement new formatter: Redundant, existing function covers use case.

### Decision 12: No API Changes

**Choice**: Reuse existing GET /concerts/:id and GET /concerts/:id/ticket-types endpoints. Do not call any new endpoint for selections.

**Rationale**: Selection is client-only state. No need to sync with server or track partially selected orders. Future checkout will call POST /orders with final selections.

## Risks / Trade-offs

| Risk                                                                                                                                                                                                                   | Mitigation                                                                                                                                                                               |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Stale availability data** - Concurrent purchases by other users are not reflected in real-time. User may select a quantity that exceeds actual remaining inventory by the time checkout begins.                      | Mitigated by server-side validation during order creation (future phase). MVP accepts this gap; real-time availability sync is complex (requires WebSocket or polling) and out of scope. |
| **Selection loss on page refresh** - Users who accidentally refresh lose their selections (no persistence).                                                                                                            | Acceptable for MVP. Users complete flow in one session. Persistence can be added in future (localStorage or session storage). Add warning on beforeunload if needed.                     |
| **No auth context** - Feature does not verify user identity or cross-check against existing orders/limits. Abuse scenario: User selects 1000 tickets, total quantity shows, but backend rejects during order creation. | Deferred to order creation phase. Backend will enforce auth and limits. MVP assumes honest users and focuses on UX for valid cases.                                                      |
| **Price display ambiguity** - Line total = quantity × unit price, but totals don't account for future discounts, taxes, or fees applied at checkout.                                                                   | Clear in UI: summary shows "ticket cost", not "final price". Checkout phase will show adjusted amounts. Acceptable framing.                                                              |
| **Mobile viewport crowding** - Summary + continue button may push content off-screen on small devices.                                                                                                                 | Mitigated by responsive CSS (responsive padding, font sizing). Test on real devices during verification phase. Consider sticky footer in follow-up if UX testing indicates problem.      |
| **No undo/clear-all** - Users must click minus button repeatedly to clear selections. No "Clear All" action.                                                                                                           | Acceptable for MVP. Simple workflow (few tickets typically selected). Can add bulk actions in future.                                                                                    |

## Migration Plan

**Deployment**:

1. Deploy frontend changes: ConcertDetailPage.tsx, TicketTypeCard.tsx (refactored), new TicketSelectionSummary.tsx, updated styles.css, types.ts (if new types added, likely local only).
2. No backend deployment needed (no API changes).
3. Feature is automatically available on `/concerts/:id` when page loads.

**Rollback**:

- If critical issue discovered: Revert component files and CSS to previous version. No database or API state to clean up.
- Selections exist only in memory; no cleanup required.

**Verification**:

- Automated: TypeScript typecheck, linting, build validation.
- Manual: Functional testing on concert detail page (load detail, select quantities, verify summary, click continue, see message).
- No new test infrastructure needed; use existing E2E testing strategy.

## Open Questions

1. **Checkout UX after "Continue"** - Where does user go after clicking "Tiếp tục đặt vé"? Navigate to checkout page? Open modal form? Show login prompt? → Decision deferred to order creation phase.

2. **Selection timeout** - If user selects 10 tickets but waits 1 hour before checkout, should selections expire or warn? → Decision deferred; MVP has no timeout, selections persist until page refresh.

3. **Inventory sync frequency** - Should availableQuantity refresh periodically (e.g., poll every 30s) to reflect concurrent purchases? → Out of scope for MVP; ticket availability is a snapshot from load time. Server enforces accurate inventory during order creation.

4. **Toast vs. inline Alert for continue message** - Should use system-wide toast service instead of inline Alert? → Acceptable if toast service exists; otherwise inline Alert works. Verify with design system.

5. **Accessibility** - Do ± buttons need ARIA labels, keyboard shortcuts, or screen reader testing? → Yes, add ARIA labels (aria-label, aria-pressed). Include in verification phase.
