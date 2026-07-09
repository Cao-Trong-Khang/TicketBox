## ADDED Requirements

### Requirement: Organizer revenue dashboard UI removes edit and empty-state banner

The organizer revenue dashboard SHALL remove the edit-concert action and the informational banner shown when no paid orders exist, while preserving the existing back navigation, summary metrics, ticket-type breakdown, loading state, error state, and zero-data metric display.

#### Scenario: Revenue page no longer exposes edit action

- **WHEN** an organizer opens the revenue dashboard for a concert
- **THEN** the page does not render an edit-concert action in the header actions area

#### Scenario: Revenue page no longer shows the no-paid-orders banner

- **WHEN** the revenue summary reports zero paid orders
- **THEN** the page does not render the informational message about no successful payments

#### Scenario: Existing revenue dashboard content remains available

- **WHEN** an organizer opens the revenue dashboard
- **THEN** the page still renders the back link, concert header, summary metrics, ticket-type breakdown, loading state, error state, and zero-value metrics as appropriate
