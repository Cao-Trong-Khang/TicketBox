## Specification: Concert Timing Semantics

## Description

Organizers need a clear way to define when a concert is on sale and when the actual performance begins. Audiences need a clear way to understand both the ticket sale period and the event time. The system SHALL separate these two concepts in the concert model, organizer workflows, public display, and purchase validation while preserving the existing organizer flow structure.

## Main Flow

1. An organizer opens the concert create or edit experience and enters a ticket sale window using the existing concert start/end fields plus a separate performance start time.
2. The backend stores the sale window and performance start as distinct values and validates that the sale window is logically consistent.
3. The system uses the sale window to determine ticket availability lifecycle state such as upcoming, ongoing, or ended, while preserving override states such as cancelled or finished.
4. Public concert listing and detail pages display the performance start as the primary event time and show the sale window as the context for whether tickets are currently available.
5. Order creation validates ticket availability against the concert-level sale window instead of relying on ticket-type sale-window checks.

## Failure Scenarios

### Scenario 1: Invalid sale window

- **WHEN** an organizer submits a concert with a sale window where the start is later than or equal to the end
- **THEN** the backend rejects the request with a validation error
- **AND** the organizer is prompted to correct the dates

### Scenario 2: Missing performance start during rollout

- **WHEN** a concert is created or updated without an explicit performance start
- **THEN** the system accepts the record and uses the sale-window start as a fallback display value until a more specific performance time is provided

### Scenario 3: Purchase outside sale window

- **WHEN** an audience member attempts to create an order after the concert sale window has closed
- **THEN** the backend rejects the purchase with a clear validation error
- **AND** the public UI reflects that ticket sales are no longer open

### Scenario 4: Legacy ticket-type sale data

- **WHEN** older ticket-type records still contain sale timing values
- **THEN** the system continues to read those values for compatibility but does not use them as the source of truth for new purchase validation

## Constraints

1. The organizer experience MUST preserve the existing create/edit screen structure and field layout as much as possible.
2. The existing concert start/end fields MUST continue to exist and MUST be treated as the ticket sale window for the MVP.
3. The new performance start field MUST be stored separately from the sale window.
4. Lifecycle and availability status MUST reflect the sale window and MUST NOT depend on the performance start for the MVP.
5. The feature MUST avoid changing unrelated payment, QR, or check-in behavior.

## Acceptance Criteria

### Test Case 1: Organizer can define both concepts

- **GIVEN** an organizer is creating or editing a concert
- **WHEN** they enter the sale window and a separate performance start time
- **THEN** the backend stores both values distinctly and accepts the record

### Test Case 2: Sale window validation works

- **GIVEN** an organizer submits invalid sale dates
- **WHEN** the start is after or equal to the end
- **THEN** the request is rejected with a validation error

### Test Case 3: Public display uses performance time as event time

- **GIVEN** a published concert has a performance start time
- **WHEN** an audience user views the concert list or detail page
- **THEN** the event time shown to the audience is based on the performance start field

### Test Case 4: Purchase validation uses concert sale window

- **GIVEN** a published concert is outside its sale window
- **WHEN** an audience user attempts to create an order
- **THEN** the system blocks the purchase and returns a clear validation error

### Test Case 5: Legacy records remain usable

- **GIVEN** an older concert record has no explicit performance start value
- **WHEN** it is displayed or edited
- **THEN** the system continues to work and falls back to the sale-window start for display purposes
