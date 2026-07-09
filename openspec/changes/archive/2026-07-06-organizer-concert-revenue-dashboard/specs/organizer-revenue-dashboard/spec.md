## ADDED Requirements

### Requirement: Organizer can view a revenue dashboard for an owned concert
The system SHALL provide an organizer-only revenue dashboard for a single concert owned by the authenticated organizer. The Web Application SHALL navigate to the dashboard from the organizer area, and the Backend API SHALL reject requests from unauthenticated users, non-organizer users, or organizers requesting a concert they do not own.

#### Scenario: Organizer opens owned concert revenue dashboard
- **WHEN** an authenticated organizer opens the revenue dashboard for a concert they own
- **THEN** the Web Application loads organizer-scoped reporting data for that concert and renders the dashboard successfully

#### Scenario: Unauthenticated request is denied
- **WHEN** a user without a valid JWT requests the organizer revenue dashboard API
- **THEN** the Backend API returns `401 Unauthorized`

#### Scenario: Foreign concert request is hidden
- **WHEN** an authenticated organizer requests revenue data for a concert they do not own
- **THEN** the Backend API returns `404 Not Found`

### Requirement: Revenue dashboard response includes concert header, summary metrics, and ticket-type breakdown
The system SHALL expose a dedicated organizer revenue endpoint for an owned concert that returns the concert header data, summary sales metrics, and ticket-type sales breakdown needed by the organizer dashboard. The response SHALL be derived from existing PostgreSQL concert, ticket type, order, and order item data and SHALL NOT depend on Redis as the source of truth.

#### Scenario: Revenue response includes concert header data
- **WHEN** an organizer requests revenue data for an owned concert
- **THEN** the response includes concert metadata needed by the dashboard header, including `id`, `title`, `artistName`, `venueName`, `venueAddress`, `bannerUrl`, `status`, and performance date/time fields

#### Scenario: Revenue response includes summary metrics
- **WHEN** an organizer requests revenue data for an owned concert
- **THEN** the response includes summary metrics for `totalRevenueVnd`, `totalSoldQuantity`, `totalReservedQuantity`, `totalAvailableQuantity`, `totalTicketQuantity`, `soldRate`, and `paidOrderCount`

#### Scenario: Revenue response includes ticket-type breakdown
- **WHEN** an organizer requests revenue data for an owned concert
- **THEN** the response includes each ticket type with `code`, `name`, `priceVnd`, `totalQuantity`, `reservedQuantity`, `soldQuantity`, `availableQuantity`, `revenueVnd`, and `soldRate`

### Requirement: Dashboard metrics separate paid revenue from reserved inventory
The system SHALL compute revenue only from successful paid orders and SHALL keep reserved or held tickets separate from sold tickets. Dashboard metrics SHALL NOT count `PENDING`, `FAILED`, `EXPIRED`, or `CANCELLED` orders as revenue.

#### Scenario: Pending reservations do not count as revenue
- **WHEN** a concert has pending orders that still hold reserved ticket quantity
- **THEN** those orders increase reserved metrics only and do not increase `totalRevenueVnd` or sold metrics

#### Scenario: Paid orders contribute to revenue
- **WHEN** a concert has successful paid orders in the existing order data
- **THEN** the dashboard includes those orders in `totalRevenueVnd`, `paidOrderCount`, and ticket-type `revenueVnd`

#### Scenario: Empty paid data is rendered safely
- **WHEN** a concert has ticket inventory configured but no paid orders yet
- **THEN** the dashboard still renders with zero revenue and the correct reserved, sold, available, and total quantities
