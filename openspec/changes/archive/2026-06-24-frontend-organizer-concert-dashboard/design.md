## Context

The frontend already has a public concert browsing flow, shared API helpers, and a consistent page-shell pattern. The organizer dashboard can fit into that existing structure without introducing new architecture or backend changes.

## Goals / Non-Goals

**Goals:**

- Add a dedicated frontend route for organizers to browse concerts they own.
- Reuse existing API client conventions and shared UI components for a consistent experience.
- Provide clear empty, loading, and error states for organizer users.
- Keep action controls visible but non-functional for now.

**Non-Goals:**

- Create or edit concert forms.
- Implement ticket-type management UI.
- Add role-based redirects or global guards.
- Change backend behavior.

## Decisions

- Use a new feature folder under the existing frontend feature structure, rather than mixing organizer logic into the public concerts feature.
- Reuse the existing `apiFetch` helper and `ApiError` status handling so the organizer page behaves consistently with the rest of the app.
- Follow the same loading/error/empty-state pattern already used by the public concerts list page to reduce UI churn.
- Use placeholder action buttons marked as “Sắp ra mắt” instead of linking to unimplemented routes, which avoids broken navigation UX.
- Add a simple top-level navigation link in the app shell for discoverability without changing the app shell design.

## Risks / Trade-offs

- [The organizer endpoint may return 401/403 for unauthenticated or non-organizer users.] → The UI will render localized guidance and avoid assuming access.
- [The page is intentionally placeholder-driven for future management flows.] → The current implementation will be simple and focused on reliable data loading and messaging.

## Migration Plan

- No data migration is required.
- The change is isolated to frontend route, layout, feature components, and styles.

## Open Questions

- None; the implementation can proceed with the current frontend-only scope.
