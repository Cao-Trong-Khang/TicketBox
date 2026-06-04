## ADDED Requirements

### Requirement: Audience can create checkout orders

The system SHALL allow Audience users with `ticket:purchase` permission to select a ticket type and quantity, create a checkout order, and proceed to payment when the concert and ticket type are on sale.

#### Scenario: Valid checkout creates pending order

- **GIVEN** a published concert has remaining VIP tickets and the sale window is open
- **WHEN** an Audience user submits `POST /checkout/orders` for an allowed quantity
- **THEN** the system MUST create a pending payment order and return payment initiation options

#### Scenario: Ticket type is sold out

- **GIVEN** a ticket type has no remaining quantity
- **WHEN** an Audience user submits `POST /checkout/orders`
- **THEN** the system MUST reject the checkout without creating a payable order

### Requirement: Inventory cannot oversell under concurrency

The system SHALL use Redis Lua distributed locks and PostgreSQL pessimistic row locks with `FOR UPDATE` to prevent more paid tickets from being issued than the configured ticket type quantity.

#### Scenario: Many users contend for limited SVIP tickets

- **GIVEN** 200 SVIP tickets remain and many users submit checkout requests at the sale start
- **WHEN** the checkout service processes concurrent requests for SVIP tickets
- **THEN** the system MUST issue no more than 200 final paid SVIP tickets

#### Scenario: Redis lock cannot be acquired

- **GIVEN** Redis is unavailable or the ticket-type lock cannot be acquired
- **WHEN** an Audience user submits `POST /checkout/orders`
- **THEN** the system MUST fail closed for checkout, return a retryable error, and MUST NOT decrement PostgreSQL inventory

### Requirement: Purchase limits are enforced across paid orders

The system SHALL enforce configurable per-user purchase limits per concert and ticket type across all successfully paid orders, including simultaneous smaller checkout attempts.

#### Scenario: User submits simultaneous smaller orders

- **GIVEN** the per-user VIP limit is 4 and the user already has 2 paid VIP tickets
- **WHEN** the user submits two concurrent checkout requests for 2 VIP tickets each
- **THEN** the system MUST allow at most one request to proceed and MUST prevent the paid total from exceeding 4

### Requirement: Audience can view issued e-tickets

The system SHALL allow Audience users to view their issued QR-code e-tickets after successful payment and ticket issuance.

#### Scenario: Audience views issued e-ticket

- **GIVEN** an Audience user owns an issued ticket for a paid order
- **WHEN** the user requests `GET /me/tickets/{ticketId}`
- **THEN** the system MUST return the ticket details and QR-code e-ticket information

#### Scenario: Audience cannot view another user's ticket

- **GIVEN** an Audience user does not own a ticket
- **WHEN** the user requests `GET /me/tickets/{ticketId}` for that ticket
- **THEN** the system MUST reject the request with `403 Forbidden` or `404 Not Found`
