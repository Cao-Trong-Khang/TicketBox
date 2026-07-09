## 1. Backend Revenue API

- [x] 1.1 Add organizer revenue DTO/types for concert header, summary metrics, and ticket-type breakdown in the organizer concerts module.
- [x] 1.2 Implement organizer-scoped revenue aggregation in the backend using existing `concerts`, `ticket_types`, `orders`, and `order_items` data without adding new tables or changing payment flow.
- [x] 1.3 Add `GET /organizer/concerts/:id/revenue` to the organizer concerts controller, protected by the existing JWT and organizer ownership checks.
- [x] 1.4 Ensure revenue counts only `PAID` orders, keeps `reservedQuantity` separate from `soldQuantity`, and returns correct zero values when a concert has no paid orders yet.

## 2. Organizer Dashboard Entry Point

- [x] 2.1 Update the organizer concert card component to add a `Doanh thu` action while preserving the existing `Sửa` and `Hủy` actions.
- [x] 2.2 Add organizer frontend API and type support for fetching per-concert revenue data from the new backend endpoint.
- [x] 2.3 Add the organizer revenue dashboard route and navigation flow from the organizer concert card.

## 3. Organizer Revenue Page

- [x] 3.1 Build the organizer revenue dashboard page with concert header information and summary metric cards using existing organizer-facing layout patterns.
- [x] 3.2 Render a ticket-type breakdown showing price, total, reserved, sold, remaining, revenue, and sell-through values for each ticket type.
- [x] 3.3 Add empty/error/loading handling so the dashboard remains usable when there are no paid orders yet or when the organizer request fails.

## 4. Verification

- [x] 4.1 Add or update backend tests covering organizer-owned revenue access, unauthenticated `401`, and foreign-concert denial behavior.
- [x] 4.2 Add or update frontend tests covering organizer card `Doanh thu` action visibility and dashboard rendering from fetched revenue data.
- [x] 4.3 Run local backend and frontend build/test commands and verify the organizer can open the dashboard, see zero-value metrics for unpaid data, and see paid-only revenue when paid fixtures exist.
