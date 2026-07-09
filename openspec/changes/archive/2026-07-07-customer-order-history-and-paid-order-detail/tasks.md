## 1. Align Scope Before UI Work

- [x] 1.1 Verify proposal, design, and specs describe frontend-only work and contain no backend API, persistent-detail, payment polling, ticket issuance, or QR implementation requirements (AC: frontend-only constraint).
- [x] 1.2 Confirm the `create-order-flow` capability is not modified and `/orders/:orderId` plus `OrderPendingPage` keep their existing behavior (AC: existing pending detail unchanged).

## 2. Frontend View Models and Helpers

- [x] 2.1 Define minimal order-history TypeScript view models and status union without payment-provider, ticket, QR, or callback fields (AC: history cards).
- [x] 2.2 Define a replaceable frontend history data-source/API client boundary and document the future backend dependency (AC: history dependency unavailable).
- [x] 2.3 Add Vietnamese status labels, `vi-VN` VND formatting, and `Asia/Ho_Chi_Minh` date formatting helpers (AC: all statuses; paid card).

## 3. Order History UI

- [x] 3.1 Add authenticated `/orders` route and `OrderHistoryPage` without modifying `/orders/:orderId` (AC: Audience opens history; pending detail unchanged).
- [x] 3.2 Build responsive order cards with banner fallback, concert/order metadata, ticket quantities, VND total, and textual status (AC: paid card; all statuses).
- [x] 3.3 Omit or disable persistent-detail actions until a supported detail contract exists (AC: missing persistent detail support).
- [x] 3.4 Implement accessible loading, empty, unavailable/error, and retry states (AC: dependency states).
- [x] 3.5 Ensure production runtime never falls back to hard-coded orders, test fixtures, or localStorage history (AC: unavailable dependency).

## 4. AppShell and Styling

- [x] 4.1 Add role-aware “Sự kiện” and “Đơn hàng của tôi” navigation while preserving Organizer redirects and logout (AC: shell navigation).
- [x] 4.2 Add `aria-current`, semantic announcements, visible focus, status text, and meaningful banner alternatives (AC: keyboard navigation).
- [x] 4.3 Add responsive styles using existing CSS variables/surfaces and verify no mobile overflow (AC: narrow viewport).

## 5. Frontend Tests

- [x] 5.1 Test route rendering, heading, and that `/orders/:orderId` behavior remains unchanged (AC: route and compatibility).
- [x] 5.2 Test all status labels, card fields, banner fallback, Vietnamese dates, and VND amounts using test-only mocked responses (AC: cards and statuses).
- [x] 5.3 Test loading, successful-empty, successful-list, unavailable, and retry states (AC: dependency states).
- [x] 5.4 Test that request failure never displays fixture/localStorage orders (AC: no production mock fallback).
- [x] 5.5 Test keyboard focus, semantic status/error output, AppShell active navigation, Organizer regression, and narrow layout (AC: accessibility/navigation).

## 6. Verification and Handoff

- [x] 6.1 Run frontend lint, typecheck, tests, and build; do not change or require backend tests (AC: frontend-only scope).
- [x] 6.2 Document the future backend history contract as a dependency, explicitly deferring ownership enforcement, pagination implementation, payment, tickets, QR, and polling (AC: dependency boundary).
- [x] 6.3 Manually verify `/orders` loading/empty/unavailable/list presentations with development tooling or test harness data that cannot ship as production authority (AC: complete UI states).
