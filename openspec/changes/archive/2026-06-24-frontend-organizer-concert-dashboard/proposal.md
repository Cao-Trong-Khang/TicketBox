## Why

Organizer users currently land in the same public-facing customer experience after login, which makes it difficult to manage the concerts they own. A dedicated organizer dashboard gives organizers a clear entry point to browse their concerts, while keeping the change scoped to the frontend and the existing backend organizer APIs.

## What Changes

- Add a new organizer dashboard route at /organizer/concerts.
- Create a frontend organizer-concerts feature area for loading and displaying organizer-owned concerts.
- Add a navigation entry for the organizer channel from the existing app shell.
- Show loading, error, empty, and list states for organizer concerts.
- Provide placeholder actions for creating, editing, and managing ticket types without implementing those pages in this task.
- Handle 401 and 403 responses with the requested localized messages and navigation guidance.

## Capabilities

### New Capabilities

- organizer-concert-dashboard: organizer users can view a dashboard of concerts they own through the frontend.

### Modified Capabilities

- None.

## Impact

- Frontend routing and layout in the React/Vite app.
- Organizer-facing UI under the existing concert feature structure.
- Existing API client and shared UI components.
- No backend schema or API contract changes are required for this task.
