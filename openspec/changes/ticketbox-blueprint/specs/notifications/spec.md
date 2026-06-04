## ADDED Requirements

### Requirement: Purchase confirmation notifications are sent after payment success
The system SHALL send in-app and email purchase confirmations with attached or linked QR-code e-tickets after successful payment and ticket issuance.

#### Scenario: Tickets are issued after successful payment
- **GIVEN** an order has transitioned to paid and QR-code tickets were issued
- **WHEN** the notification worker processes the ticket-issued event
- **THEN** the system MUST create an in-app notification and send an email containing the e-ticket information

#### Scenario: Email provider fails temporarily
- **GIVEN** the email provider is unavailable
- **WHEN** the notification worker attempts to send a confirmation email
- **THEN** the system MUST retain the notification job for retry and MUST NOT roll back the paid order or issued tickets

### Requirement: Concert reminders are scheduled 24 hours before start
The system SHALL send automatic reminders 24 hours before the concert through the notification channel abstraction.

#### Scenario: Reminder is due
- **GIVEN** a concert starts in 24 hours and paid ticket holders exist
- **WHEN** the reminder worker runs
- **THEN** the system MUST enqueue reminder notifications for eligible ticket holders

### Requirement: Notification channels are extensible
The system SHALL model notification delivery through channel adapters so future Zalo OA or SMS channels can be added without redesigning purchase, ticketing, or reminder workflows.

#### Scenario: New channel is configured
- **GIVEN** a future SMS channel adapter is enabled
- **WHEN** a reminder notification is created
- **THEN** the system MUST route delivery through configured channels without changing the reminder business rule
