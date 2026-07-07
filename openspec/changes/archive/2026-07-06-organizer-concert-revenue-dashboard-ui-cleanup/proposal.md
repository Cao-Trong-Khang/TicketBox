## Why

The organizer revenue dashboard currently exposes a small edit entry point and an informational banner for zero paid orders that do not belong in the intended UX. This cleanup removes those UI elements while preserving the existing dashboard behavior, zero-value metrics, loading and error states, and the existing organizer navigation flow.

## What Changes

- Remove the "Sửa concert" button from the organizer revenue dashboard screen.
- Remove the informational message shown when there are no paid orders, without replacing it with another similar banner.
- Preserve the existing back link, concert header, summary metrics, ticket-type breakdown, loading state, error state, and zero-data metric rendering.

## Capabilities

### New Capabilities

- None. This change is a focused frontend UI cleanup and does not introduce a new product capability.

### Modified Capabilities

- organizer-concert-management: The organizer revenue dashboard UI behavior changes for an existing organizer-facing experience, but no backend or spec-level requirement is being introduced.

## Impact

- Frontend organizer revenue page UI in the organizer concert experience.
- Related organizer revenue page test coverage.
- No backend API, calculation logic, route structure, or organizer dashboard card actions are changed.
