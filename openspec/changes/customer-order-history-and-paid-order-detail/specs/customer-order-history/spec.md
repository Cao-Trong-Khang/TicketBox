## Specification: Customer Order History UI

## Description

The Web Application SHALL provide authenticated Audience users with a frontend order-history list interface. This capability presents data supplied through a frontend data-source boundary and does not implement backend history, payment, ticket issuance, QR, or persistent detail behavior.

## Main Flow

1. An authenticated Audience user opens `/orders`.
2. The Web Application requests history through the frontend data-source boundary.
3. While waiting, the page renders an accessible loading state.
4. On success, the page renders either newest-first order cards or an empty state.
5. Each card formats Vietnamese dates, VND amounts, concert details, ticket quantities, and textual status.
6. If the dependency is unavailable, the page renders an unavailable state and retry action without fabricating orders.

## Failure Scenarios

- A request failure or unimplemented endpoint MUST show “unavailable”, not a false empty history.
- A malformed optional field or failed banner image MUST not crash the page.
- Missing persistent detail support MUST not be represented as a working detail action.
- Test fixtures MUST NOT leak into production runtime behavior.

## Constraints

- This change MUST modify frontend code only.
- It MUST NOT modify NestJS, Prisma, migrations, Docker services, payment, ticket, or QR behavior.
- It MUST NOT modify the existing `/orders/:orderId` flow.
- Runtime order history MUST NOT come from hard-coded arrays or localStorage.
- Mock data MAY be used only in automated frontend tests.
- Status MUST be communicated with text, not color alone.
- The UI MUST be responsive, keyboard accessible, and consistent with existing TicketBox components.

## Acceptance Criteria

## ADDED Requirements

### Requirement: Audience can open the frontend history page
The Web Application SHALL expose authenticated `/orders` routing without changing `/orders/:orderId` behavior.

#### Scenario: Authenticated Audience opens history
- **GIVEN** an authenticated Audience session
- **WHEN** the user opens `/orders`
- **THEN** the page MUST render the “Lịch sử đơn hàng” heading and request data through the frontend boundary

#### Scenario: Existing pending detail remains unchanged
- **WHEN** the history UI is introduced
- **THEN** `OrderPendingPage`, its navigation-state fallback, and the existing `/orders/:orderId` contract MUST remain unchanged

### Requirement: History cards present order summaries
The UI SHALL render responsive order cards from supplied history view models.

#### Scenario: Paid order card renders
- **GIVEN** the data source returns a PAID order
- **WHEN** its card renders
- **THEN** it MUST show concert title, banner or fallback, order code, creation date, performance date, venue, ticket quantity summary, VND total, and “Đã thanh toán”
- **AND** it MUST NOT imply that QR tickets or persistent detail are available

#### Scenario: Every known status renders text
- **WHEN** cards contain PENDING, PAID, FAILED, EXPIRED, or CANCELLED
- **THEN** they MUST render “Chờ thanh toán”, “Đã thanh toán”, “Thanh toán thất bại”, “Đã hết hạn”, or “Đã hủy” respectively

### Requirement: History UI distinguishes dependency states
The page SHALL distinguish loading, successful-empty, successful-list, and unavailable states.

#### Scenario: Loading history
- **WHEN** the data request is pending
- **THEN** the page MUST show an accessible loading indication

#### Scenario: Successful empty history
- **GIVEN** the data source successfully returns no orders
- **WHEN** loading completes
- **THEN** the page MUST show Vietnamese empty guidance and a concert-discovery action

#### Scenario: History dependency unavailable
- **WHEN** the request fails or the endpoint is not implemented
- **THEN** the page MUST show an unavailable/error message and retry action
- **AND** MUST NOT substitute test fixtures, hard-coded orders, or localStorage data

### Requirement: History UI is accessible and responsive
The page SHALL remain usable by keyboard and across supported viewport sizes.

#### Scenario: Keyboard navigation
- **WHEN** a user navigates without a pointer
- **THEN** all actions MUST be reachable with visible focus and loading/errors/statuses MUST have semantic text

#### Scenario: Narrow viewport
- **WHEN** cards render on a narrow viewport
- **THEN** content MUST avoid horizontal overflow and controls MUST remain touch friendly
