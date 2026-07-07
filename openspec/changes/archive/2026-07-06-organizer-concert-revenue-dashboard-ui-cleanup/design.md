## Context

The organizer revenue dashboard is a frontend-only experience within the existing organizer concert management flow. The current page already supports the core dashboard behaviors, including loading, error, summary metrics, and ticket-type breakdown rendering. The requested change is limited to removing two UI elements: the edit-concert action and the informational banner shown when there are no paid orders.

## Goals / Non-Goals

**Goals:**

- Remove the revenue page edit action while preserving navigation back to the organizer dashboard.
- Remove the no-paid-orders informational banner without affecting the existing zero-value metric display.
- Keep the change scoped to the frontend revenue page and its related test coverage.

**Non-Goals:**

- No backend API changes.
- No revenue calculation changes.
- No route, navigation, or organizer dashboard card behavior changes.
- No changes to zero-value metric rendering or the existing loading/error states.

## Decisions

- Keep the implementation localized to the existing organizer revenue page component and its associated test file.
- Remove the edit button from the page header toolbar and leave the back link in place.
- Remove the conditional alert block that renders the no-paid-orders informational message while preserving the existing summary data rendering.
- Update the test to reflect the removed edit action without changing the broader page behavior assertions.

## Risks / Trade-offs

- [UI regression risk] → Keep the change small and targeted so the rest of the revenue page structure remains unchanged.
- [Test brittleness] → Update only the assertions that directly reflect the removed UI elements.
