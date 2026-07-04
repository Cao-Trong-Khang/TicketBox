## Specification: Concert Seating Map

## Description

The system SHALL let organizers upload a seating map as an SVG file when creating or editing a concert, store the sanitized SVG text on the concert record, and let audience users view an interactive inline SVG map that highlights ticket zones and shows ticket-type availability. This capability is used by Organizer users when managing concerts and by Audience users when viewing concert details.

## Main Flow

1. An Organizer uploads an SVG file from the concert create or edit form in the Web Application.
2. The Web Application reads the file as text and submits the resulting seatingSvg value through the existing organizer concert create/update API.
3. The Backend API validates the SVG content, sanitizes it, and stores the sanitized markup in the Concert.seatingSvg field in PostgreSQL.
4. The audience-facing Web Application requests the public concert detail and ticket-type data from the Backend API.
5. The Web Application renders the sanitized SVG inline as an interactive map and maps zones to ticket types for hover, focus, and click interactions.
6. The Web Application polls the public ticket-type endpoint to refresh remaining availability without changing checkout, payment, or check-in behavior.

## Failure Scenarios

- WHEN an organizer uploads an empty, oversized, malformed, or unsafe SVG file, THEN the Backend API SHALL reject the request with a validation error and SHALL NOT persist the content.
- WHEN the SVG content is not clearly SVG-like or no longer contains a valid svg root after sanitization, THEN the Backend API SHALL reject the request with a 400 error.
- WHEN the organizer edits a concert without uploading a new SVG file, THEN the system SHALL preserve the existing stored seatingSvg value.
- WHEN a public concert has no seating map, THEN the audience detail page SHALL show a neutral placeholder instead of crashing.
- WHEN ticket-type polling fails, THEN the page SHALL keep rendering the existing content and show a non-blocking error state instead of crashing.
- WHEN a zone has no matching ticket type, THEN the interactive map SHALL show a graceful fallback rather than failing.

## Constraints

- The system SHALL keep seating SVG as sanitized SVG text in the existing Concert.seatingSvg field and SHALL NOT store it as a URL or banner asset.
- The system SHALL NOT introduce WebSocket or SSE-based ticket availability updates.
- The system SHALL NOT change checkout, payment, order, ticket issuance, or check-in flows.
- The system SHALL NOT render full seating SVG content on the public concert list.
- The system SHALL NOT add seat-level booking or an in-app SVG editor.
- The system SHALL sanitize SVG content on the backend as the authoritative source of truth and SHALL sanitize again in the frontend as defense in depth.
- The system SHALL preserve existing public concert list behavior and keep the detail page interaction read-only.

## Acceptance Criteria

- GIVEN an Organizer uploads a valid SVG file for a new concert, WHEN the form is submitted, THEN the Backend API SHALL save sanitized SVG text and the concert detail view SHALL render it inline.
- GIVEN an Organizer edits a concert without selecting a new SVG file, WHEN the update request is sent, THEN the existing seatingSvg value SHALL remain unchanged.
- GIVEN a malicious SVG payload is submitted, WHEN the Backend API processes the save request, THEN the content SHALL be rejected and the concert SHALL NOT be saved with unsafe markup.
- GIVEN a public concert contains a seating map and ticket types, WHEN an audience user opens the concert detail page, THEN the map SHALL render inline, zones SHALL be interactive, and selecting or hovering a zone SHALL display matching ticket-type information.
- GIVEN ticket availability changes, WHEN the concert detail page polls the ticket-type endpoint, THEN the displayed available quantities SHALL update without affecting checkout state.
- GIVEN the ticket-type polling endpoint is unavailable, WHEN the page refreshes or the request fails, THEN the page SHALL remain usable and show a non-blocking error state.
