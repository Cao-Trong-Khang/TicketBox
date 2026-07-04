## Why

The seating SVG preview appears correct in the organizer form, but the saved and reloaded SVG is clipped or largely blank in the organizer and public seat-map views. This indicates the save/reload path is altering the SVG in a way that breaks its layout and coordinate system, which undermines the concert seating experience after the organizer saves changes.

## What Changes

- Preserve the layout-critical SVG structure and attributes during the backend sanitization step so saved seat maps continue to render correctly after reload.
- Keep the existing save flow and architecture intact without changing storage strategy, URL-based SVG handling, checkout flow, or public-detail redesign.
- Ensure the organizer preview and the public seat-map render the same saved SVG semantics after the concert is saved.

## Capabilities

### New Capabilities

- `seat-map-sanitization-fix`: Preserve safe and layout-critical SVG attributes so saved seating maps keep their intended layout after reload.

### Modified Capabilities

- `organizer-concert-management`: Adjust the seat-map save/reload experience so organizer updates preserve the rendered SVG structure after persistence.
- `concert-detail-page`: Preserve public seat-map readability after a concert is saved and reloaded.

## Impact

- Backend SVG sanitization and concert save/update flow.
- Organizer concert form preview and saved concert rendering.
- Public concert detail seat-map rendering.
- No changes to checkout, order, payment, or check-in behavior.
