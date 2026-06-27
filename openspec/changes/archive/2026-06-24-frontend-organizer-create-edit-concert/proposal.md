## Why

Organizer users can already view their concerts in the dashboard, but they cannot yet create a new concert or edit an existing one from the web app. This blocks the core organizer workflow for setting up events and preparing them for publication, so the MVP experience is incomplete for the organizer role.

## What Changes

- Add organizer-facing create and edit concert flows in the frontend.
- Support creating a draft concert from the organizer dashboard and navigating directly into edit mode afterward.
- Support loading, updating, and publishing draft concerts from the organizer UI.
- Keep the scope limited to the organizer concert management MVP without introducing ticket-type editing, image upload, or seating-map editing.

## Capabilities

### New Capabilities

- organizer-concert-management: organizer create, edit, and publish flows for concert setup in the web app.

### Modified Capabilities

- organizer-dashboard: organizer dashboard actions now link to create and edit concert flows.

## Impact

- Frontend organizer routes and pages under the organizer concert feature area.
- Frontend organizer API helpers and shared form state handling.
- Existing organizer dashboard navigation and organizer auth flow.
- No backend API changes are expected unless a clear mismatch is discovered during implementation.
