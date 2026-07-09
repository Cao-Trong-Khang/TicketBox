## MODIFIED Requirements

### Requirement: Audience can create checkout orders

The system SHALL allow Audience users with `ticket:purchase` permission to select a ticket type and quantity, create a checkout order, and proceed to payment when the concert and ticket type are on sale. The payment process is handled by the `payments` module.

#### Scenario: Valid checkout creates pending order

- **GIVEN** a published concert has remaining VIP tickets and the sale window is open
- **WHEN** an Audience user submits `POST /checkout/orders` for an allowed quantity
- **THEN** the system MUST create a pending order and initiate the payment flow by calling the `payments` module, which returns payment initiation options.

#### Scenario: Ticket type is sold out

- **GIVEN** a ticket type has no remaining quantity
- **WHEN** an Audience user submits `POST /checkout/orders`
- **THEN** the system MUST reject the checkout without creating a payable order
