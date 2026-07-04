## Specification: Seat Map Sanitization Fix

## Description

The system SHALL preserve the layout and rendering semantics of uploaded seating SVG markup when it is sanitized and persisted for organizer and public seat-map display. Organizer users SHALL be able to save a concert without the seat map becoming clipped or visually broken after reload, while the system continues to reject unsafe SVG content.

## Main Flow

1. An organizer uploads a seating SVG file through the organizer concert form.
2. The Web Application renders a preview of the SVG for the organizer.
3. The organizer saves the concert, and the Backend API sanitizes the SVG before persisting it.
4. The saved SVG is returned by the organizer and public concert APIs and rendered again in the organizer form and public concert detail page.
5. The rendered SVG SHALL preserve its layout-critical semantics so the seat map remains readable and visually complete.

## Failure Scenarios

- If the uploaded SVG contains unsafe tags or event handlers, the Backend API SHALL reject it rather than persisting it.
- If the SVG lacks layout-critical attributes such as viewBox, width, or height, the system SHALL preserve the safe subset that remains without causing the map to collapse or clip unexpectedly.
- If the saved SVG cannot be rendered safely, the system SHALL show the existing fallback state instead of persisting unsafe markup.

## Constraints

- The change MUST preserve the existing backend sanitization and storage model.
- The change MUST NOT introduce URL-based SVG storage, MinIO, image rendering, or checkout/order/payment changes.
- The change MUST continue to reject dangerous content such as scripts, foreignObject, event handlers, and javascript URLs.
- The change MUST preserve layout-safe SVG attributes needed for seat-map rendering, especially viewBox, width, height, x, y, cx, cy, r, rx, ry, d, points, transform, fill, stroke, stroke-width, opacity, and text-positioning attributes.

## Acceptance Criteria

#### Scenario: Saved SVG preserves layout semantics

- **WHEN** an organizer uploads and saves a seating SVG
- **THEN** the saved SVG SHALL render with the same layout semantics in the organizer form and public detail view after reload
- **AND** the seat map SHALL remain readable rather than clipped or mostly blank

#### Scenario: Unsafe SVG is still rejected

- **WHEN** an organizer submits SVG markup containing unsafe tags or event handlers
- **THEN** the Backend API SHALL reject the SVG and prevent it from being saved

#### Scenario: Safe layout attributes are preserved

- **WHEN** the system sanitizes a valid seating SVG
- **THEN** safe layout and text attributes required for correct rendering SHALL be preserved in the stored SVG markup
