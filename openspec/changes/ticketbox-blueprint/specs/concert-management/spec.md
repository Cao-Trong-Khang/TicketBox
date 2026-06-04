## ADDED Requirements

### Requirement: Organizer can publish and manage concerts
The system SHALL allow Organizer users with `concert:manage` permission to create, update, cancel, and configure owned concerts, including artist information, venue, SVG seating map, ticket types, prices, capacities, sale start times, and per-user limits.

#### Scenario: Concert is created with ticket zones
- **GIVEN** an authenticated Organizer has `concert:manage` permission
- **WHEN** the Organizer submits `POST /admin/concerts` with GA, SVIP, VIP, CAT1, and CAT2 ticket types
- **THEN** the system MUST persist the concert and ticket types with configured quantities, prices, sale windows, and per-user limits

#### Scenario: Audience views published concert detail
- **GIVEN** a concert is published and the Audience user has `concert:read` permission
- **WHEN** the user requests `GET /concerts/{concertId}`
- **THEN** the system MUST return artist details, venue details, SVG seating map zones, ticket types, and sufficiently fresh availability counts

#### Scenario: Cancelled concert is no longer purchasable
- **GIVEN** an Organizer has cancelled a concert
- **WHEN** an Audience user attempts checkout for that concert
- **THEN** the system MUST reject checkout and preserve read-only cancellation information on the concert detail page

### Requirement: Organizer statistics are scoped to owned concerts
The system SHALL allow Organizer users with `analytics:read` permission to view sales and revenue statistics only for concerts they own.

#### Scenario: Organizer views own statistics
- **GIVEN** an authenticated Organizer owns the concert
- **WHEN** the Organizer requests `GET /admin/concerts/{concertId}/statistics`
- **THEN** the system MUST return sales count, paid revenue, ticket-type breakdown, and payment status summary
