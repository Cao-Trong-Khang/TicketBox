# concert-timing-semantics Specification

## Purpose
TBD - created by archiving change concert-timing-semantics. Update Purpose after archive.

## Requirements
### Requirement: Concert timing semantics separate sale window from performance time

The system SHALL separate concert ticket-sale timing from actual performance timing across the concert model, organizer workflows, public display, and purchase validation while preserving the existing organizer flow structure.

#### Scenario: Organizer defines sale window and performance start

- **WHEN** an organizer creates or edits a concert using the existing concert start/end fields plus a separate performance start time
- **THEN** the backend stores the sale window and performance start as distinct values

#### Scenario: Missing performance start during rollout falls back safely

- **WHEN** a concert is created or updated without an explicit performance start
- **THEN** the system accepts the record and uses the sale-window start as the fallback display value until a more specific performance time is provided

### Requirement: Sale window validation is enforced

The system SHALL validate that the concert-level sale window is logically consistent and that performance time is after the sale window closes.

#### Scenario: Sale window start must be before sale window end

- **WHEN** an organizer submits a concert with `startsAt >= endsAt`
- **THEN** the backend rejects the request with a validation error

#### Scenario: Performance start must be after sale end

- **WHEN** an organizer submits a concert with `endsAt >= performanceStartAt`
- **THEN** the backend rejects the request with a validation error

### Requirement: Lifecycle status reflects concert sale availability

The system SHALL compute `UPCOMING`, `ONGOING`, and `ENDED` from the concert sale window and SHALL preserve override states such as `CANCELLED` and `FINISHED`.

#### Scenario: Sale window drives lifecycle state

- **WHEN** the system evaluates a concert without an override status
- **THEN** lifecycle state is derived from the concert sale window rather than the performance start time

#### Scenario: Override statuses remain authoritative

- **WHEN** a concert has an override status such as `CANCELLED` or `FINISHED`
- **THEN** that override remains authoritative regardless of sale-window timing

### Requirement: Public display uses performance time as the primary event time

The system SHALL show `performanceStartAt` as the primary concert time for audience-facing concert list and detail experiences, while making any sale-window messaging explicit.

#### Scenario: Public list uses performance start

- **WHEN** an audience user views the concert list
- **THEN** the primary event time shown for each concert is based on `performanceStartAt`

#### Scenario: Public detail uses performance start

- **WHEN** an audience user views a concert detail page
- **THEN** the primary event time shown is based on `performanceStartAt`

#### Scenario: Sale window text is labeled explicitly

- **WHEN** the UI shows ticket availability timing to an audience user
- **THEN** that text is labeled explicitly as the concert-level ticket sale window

### Requirement: Order validation uses concert-level sale window

The system SHALL validate purchase availability against the concert-level sale window instead of using ticket-type sale-window timing as the source of truth for new order validation logic.

#### Scenario: Purchase before concert sale start is rejected

- **WHEN** an audience member attempts to create an order before the concert sale window opens
- **THEN** the backend rejects the purchase with a clear validation error

#### Scenario: Purchase after concert sale end is rejected

- **WHEN** an audience member attempts to create an order after the concert sale window closes
- **THEN** the backend rejects the purchase with a clear validation error

#### Scenario: Legacy ticket-type sale data remains compatible

- **WHEN** older ticket-type records still contain sale timing values
- **THEN** the system continues to read those values for compatibility but does not use them as the source of truth for new purchase validation
