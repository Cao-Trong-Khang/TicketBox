## ADDED Requirements

### Requirement: Payment providers are isolated by circuit breaker
The system SHALL integrate VNPAY and MoMo through provider adapters protected by Redis-backed Closed, Open, and Half-Open circuit breaker states.

#### Scenario: VNPAY timeout opens provider circuit
- **GIVEN** VNPAY requests exceed timeout or error-rate thresholds
- **WHEN** an Audience user initiates payment through VNPAY
- **THEN** the system MUST mark the VNPAY circuit Open, reject new VNPAY initiations temporarily, and keep concert browsing available

#### Scenario: One provider fails while another remains usable
- **GIVEN** the VNPAY circuit is Open and the MoMo circuit is Closed
- **WHEN** an Audience user reaches payment selection
- **THEN** the system MUST allow MoMo payment initiation and hide or disable VNPAY

### Requirement: Payment initiation is idempotent
The system SHALL require an idempotency key for payment initiation and SHALL prevent duplicate provider charge attempts for the same order, user, provider, and amount.

#### Scenario: Client retries payment initiation after timeout
- **GIVEN** a payment initiation request timed out from the client's perspective
- **WHEN** the client retries `POST /payments/initiate` with the same idempotency key
- **THEN** the system MUST return the existing payment transaction state and MUST NOT create a second provider charge

### Requirement: Payment callbacks issue tickets once
The system SHALL verify payment provider callbacks and issue QR-code e-tickets only once after confirmed successful payment.

#### Scenario: Duplicate successful callback arrives
- **GIVEN** an order is already paid and tickets were issued
- **WHEN** VNPAY or MoMo sends the same successful callback again
- **THEN** the system MUST keep the order paid, MUST NOT issue duplicate tickets, and MUST return an idempotent callback response

#### Scenario: Gateway outage does not break non-payment features
- **GIVEN** both VNPAY and MoMo circuits are Open
- **WHEN** Audience users request `GET /concerts` or `GET /concerts/{concertId}`
- **THEN** the system MUST continue serving concert and availability data from cache or database
