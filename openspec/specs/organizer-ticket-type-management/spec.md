# organizer-ticket-type-management Specification

## Purpose
TBD - created by archiving change backend-organizer-ticket-type-management. Update Purpose after archive.
## Requirements
### Requirement: Organizer can manage ticket types for owned concerts

The system SHALL provide organizer-only ticket-type management endpoints for concerts the organizer owns.

#### Scenario: Organizer lists own concert ticket types

- **WHEN** an organizer requests `GET /organizer/concerts/:concertId/ticket-types` for a concert they own
- **THEN** the backend returns the ticket types for that concert in the organizer response format

#### Scenario: Organizer is denied for a foreign concert

- **WHEN** an organizer requests organizer ticket-type endpoints for a concert they do not own
- **THEN** the backend returns `404 Not Found`

### Requirement: Organizer can create inactive ticket types

The system SHALL allow organizers to create ticket types under their owned concerts with `status = INACTIVE` by default.

#### Scenario: Organizer creates a valid ticket type

- **WHEN** an organizer submits valid create data for a ticket type on an owned concert
- **THEN** the backend creates the ticket type as `INACTIVE` and returns the created ticket-type response

#### Scenario: Duplicate code in the same concert is rejected

- **WHEN** an organizer submits a create request with a code already used by another ticket type in the same concert
- **THEN** the backend returns `409 Conflict`

### Requirement: Organizer can update mutable ticket-type fields

The system SHALL allow organizers to update supported ticket-type fields while protecting inventory and status from direct mutation.

#### Scenario: Organizer updates supported fields

- **WHEN** an organizer submits valid update data for an owned ticket type
- **THEN** the backend updates the allowed fields and returns the updated response

#### Scenario: Protected fields are rejected

- **WHEN** an organizer attempts to patch `reservedQuantity`, `soldQuantity`, `concertId`, or `status`
- **THEN** the backend rejects the update as invalid or ignored by the API contract

### Requirement: Inventory reductions must preserve existing sales state

The system SHALL reject total quantity reductions that would make `totalQuantity < reservedQuantity + soldQuantity`.

#### Scenario: Inventory reduction below reserved and sold quantity is rejected

- **WHEN** an organizer updates a ticket type to a smaller total quantity than the current reserved and sold inventory
- **THEN** the backend returns `409 Conflict`

### Requirement: Ticket-type validation rules are enforced

The system SHALL validate ticket-type create and update payloads according to the business rules for pricing, quantities, limits, and sale windows.

#### Scenario: Invalid price is rejected

- **WHEN** an organizer submits `priceVnd < 0`
- **THEN** the backend returns `400 Bad Request`

#### Scenario: Invalid quantity is rejected

- **WHEN** an organizer submits `totalQuantity <= 0` or `perUserLimit <= 0` or `perUserLimit > totalQuantity`
- **THEN** the backend returns `400 Bad Request`

#### Scenario: Invalid sale window is rejected

- **WHEN** both `saleStartAt` and `saleEndAt` are present and `saleStartAt >= saleEndAt`
- **THEN** the backend returns `400 Bad Request`

### Requirement: Organizer can activate and deactivate ticket types

The system SHALL allow organizers to switch a ticket type between `INACTIVE` and `ACTIVE` without deleting it.

#### Scenario: Ticket type activates successfully

- **WHEN** an organizer activates an owned ticket type that is currently `INACTIVE`
- **THEN** the backend sets its status to `ACTIVE`

#### Scenario: Ticket type deactivates successfully

- **WHEN** an organizer deactivates an owned ticket type that is currently `ACTIVE`
- **THEN** the backend sets its status to `INACTIVE`

#### Scenario: Repeated status toggle is rejected

- **WHEN** an organizer tries to activate an already `ACTIVE` ticket type or deactivate an already `INACTIVE` ticket type
- **THEN** the backend returns `409 Conflict`

### Requirement: Public ticket-type visibility remains based on ACTIVE status

The system SHALL continue to expose only `ACTIVE` ticket types through the public concert ticket-type endpoint.

#### Scenario: Public API reflects activation and deactivation

- **WHEN** an organizer activates or deactivates a ticket type and the relevant cache entry is invalidated
- **THEN** the public `GET /concerts/:id/ticket-types` endpoint reflects the latest ACTIVE-only ticket types

### Requirement: Cache invalidation is non-fatal

The system SHALL invalidate the existing public ticket-type cache entry for the concert after organizer changes, but SHALL not fail the organizer request if Redis cache invalidation fails.

#### Scenario: Redis invalidation failure does not block the request

- **WHEN** cache deletion fails during create, update, activate, or deactivate
- **THEN** the backend still returns the successful organizer result

