## Purpose
Define the authenticated, responsive customer order-history interface and its safe summary-detail presentation.

## Requirements

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

#### Scenario: Customer opens summary detail popup
- **GIVEN** an order card was loaded from the history data source
- **WHEN** the customer activates “Xem chi tiết đơn hàng”
- **THEN** the UI MUST open an accessible responsive dialog showing the order code, status, creation time, concert, performance time, venue, ticket-type quantities, and total amount
- **AND** the dialog MUST NOT claim persistent order detail, payment-provider data, issued tickets, or QR availability
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
