## ADDED Requirements

### Requirement: Create Payment
The system SHALL allow users to create a payment for an order.

#### Scenario: Successful payment creation
- **WHEN** a user with a pending order requests to create a payment
- **THEN** the system SHALL generate a payment URL from the selected payment provider and return it to the user.

### Requirement: Process Payment Webhook
The system SHALL process webhooks from payment providers to update payment status.

#### Scenario: Successful payment webhook
- **WHEN** the system receives a valid webhook from a payment provider indicating a successful payment
- **THEN** the system SHALL update the payment status to 'completed', update the order status, and trigger ticket generation.

#### Scenario: Failed payment webhook
- **WHEN** the system receives a valid webhook from a payment provider indicating a failed payment
- **THEN** the system SHALL update the payment status to 'failed' and update the order status.

#### Scenario: Duplicate payment webhook
- **WHEN** the system receives a webhook for a payment that is already processed
- **THEN** the system SHALL ignore the webhook and log the event.

### Requirement: Idempotent Payments
The system MUST prevent duplicate payments for the same order.

#### Scenario: Attempt to create a second payment for an order
- **WHEN** a user attempts to create a new payment for an order that already has a pending or completed payment
- **THEN** the system SHALL return an error indicating that a payment already exists.
