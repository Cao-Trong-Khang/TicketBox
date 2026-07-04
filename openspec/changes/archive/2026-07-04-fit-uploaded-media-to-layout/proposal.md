## Why

Large uploaded banner images and large seating SVG files can make the organizer form and public concert detail layout overflow horizontally or break the preview area. The issue appears to be caused by preview media being rendered at intrinsic dimensions without responsive sizing constraints, especially in the organizer form preview and the public seat-map display path.

## What Changes

- Add a minimal frontend-only fix so uploaded banner images and seating SVG previews/rendered markup fit within the available layout width without horizontal overflow.
- Preserve the existing upload, save, and rendering behavior while keeping aspect ratio intact.
- Keep the change scoped to CSS/component-level adjustments in the organizer form and public concert detail experience.

## Capabilities

### New Capabilities

- `fit-uploaded-media-to-layout`: Ensure uploaded banner images and seating SVG markup render responsively within the organizer form and public concert detail page.

### Modified Capabilities

- `organizer-concert-management`: Keep banner and seating SVG previews contained within the organizer form layout.
- `concert-detail-page`: Keep banner images and public seat-map SVG rendering contained within the page layout.

## Impact

- Frontend organizer concert form preview.
- Frontend public concert detail banner and seating map display.
- No backend, API, upload, storage, sanitizer, or checkout/order/payment changes.
