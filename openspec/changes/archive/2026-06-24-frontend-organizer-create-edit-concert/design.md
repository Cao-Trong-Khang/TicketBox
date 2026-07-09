## Context

The organizer web experience already includes a dashboard page that lists owned concerts and shows the organizer role in the app shell. The remaining gap is the ability to create a new concert draft and edit an existing one through the web app without leaving the organizer area.

The backend already exposes organizer-owned concert endpoints for list, create, detail, update, and publish operations, so the frontend can stay scoped to UI composition, form state handling, and route wiring. The design should reuse the current organizer feature module, existing API client conventions, and the existing localized error/alert patterns.

## Goals / Non-Goals

**Goals:**

- Add organizer routes for creating and editing concerts.
- Reuse the existing organizer API client structure and current UI patterns.
- Support draft creation, draft editing, and draft publishing through the frontend.
- Handle common UX states such as loading, validation errors, not-found, and unauthorized access.

**Non-Goals:**

- Ticket-type management UI.
- Image upload or media management.
- Seat map editing or rich-content editing.
- Backend schema changes.

## Decisions

- Use a shared organizer concert form component for both create and edit flows to keep behavior consistent and reduce duplication.
- Keep form values in a local `datetime-local` representation in the browser and transform them to ISO strings only when calling the API. This avoids sending ambiguous local date strings and matches the backend contract.
- After successful create, navigate to the edit page for the new concert when the API response includes an ID. This gives the organizer a direct path to continue filling out the concert details.
- Treat published concerts as read-only in the MVP. The edit page will disable update submission and display a note that published concerts are not editable in the MVP while still handling backend conflict responses gracefully.
- Keep publish behavior explicit: show a publish action only for draft concerts, and update the local UI state after a successful publish response or a refetch if the server does not return the updated object.
- Keep dashboard actions simple by linking the create button and each edit button to the new organizer routes while leaving the ticket-type action as a placeholder.

## Risks / Trade-offs

- [Date input conversion can be error-prone] → Use a dedicated formatter helper and validate the transformed values before submit.
- [Publish readiness errors may be surfaced late] → Show backend validation messages inline and keep the publish action disabled until the form is sufficiently complete.
- [Published concerts may still receive a conflict from the backend] → Catch backend `409` responses and surface a friendly note without breaking the page.
