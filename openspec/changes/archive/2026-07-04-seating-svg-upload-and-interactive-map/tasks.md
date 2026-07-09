# Tasks

## 1. Backend sanitizer implementation tasks

- [x] 1.1 Implement the backend sanitizer in the concert module, likely in a new helper such as `backend/src/modules/concerts/svg-sanitizer.ts` or a similarly named service/helper.
- [x] 1.2 Make the backend sanitizer the source of truth for all seating SVG persistence.
- [x] 1.3 Apply the sanitizer in the organizer concert save path in `backend/src/modules/concerts/organizer-concerts.service.ts` for both create and update flows.
- [x] 1.4 Validate the incoming `seatingSvg` value before persistence and reject invalid content with a 400 response.
- [x] 1.5 Enforce these rules explicitly:
  - `null` and `undefined` seating SVG values are allowed.
  - Non-empty seating SVG must be trimmed first.
  - Reject empty strings after trimming.
  - Reject content larger than the suggested 200 KB maximum.
  - Reject content that does not contain `<svg`.
  - Reject content if sanitization removes everything or if the sanitized output no longer contains `<svg`.
- [x] 1.6 Remove or reject dangerous SVG content, including:
  - `script`
  - `foreignObject`
  - `iframe`
  - `object`
  - `embed`
  - `form` / `input`
  - inline event handler attributes such as `onclick`, `onload`, `onmouseover`
  - `javascript:` URLs
  - unsafe external `href` / `xlink:href`
- [x] 1.7 Allow and preserve only a restricted SVG whitelist for seating maps:
  - tags: `svg`, `g`, `path`, `rect`, `circle`, `ellipse`, `text`, `line`, `polyline`, `polygon`
  - attributes: `id`, `class`, `data-zone`, `data-ticket-code`, `viewBox`, `fill`, `stroke`, `stroke-width`, `opacity`, `transform`, `x`, `y`, `width`, `height`, `d`, `points`, `cx`, `cy`, `r`, `rx`, `ry`
- [x] 1.8 Avoid arbitrary inline style support unless it can be safely restricted; prefer explicit SVG presentation attributes only.
- [x] 1.9 Log sanitizer rejections through the existing logger pattern in the organizer concert service rather than introducing a separate audit system.

## 2. Backend create/update integration tasks

- [x] 2.1 Update the organizer create DTO in `backend/src/modules/concerts/dto/organizer-concert-create.dto.ts` and update DTO in `backend/src/modules/concerts/dto/organizer-concert-update.dto.ts` only as needed for contract clarity; do not rely on DTO validation alone for security.
- [x] 2.2 Ensure the organizer create flow in `backend/src/modules/concerts/organizer-concerts.service.ts` passes sanitized `seatingSvg` into the persisted Concert record.
- [x] 2.3 Ensure the organizer update flow in `backend/src/modules/concerts/organizer-concerts.service.ts` preserves the existing stored SVG when a new file is not supplied.
- [x] 2.4 Do not overwrite existing `Concert.seatingSvg` with `null` or an empty string accidentally during edit submissions.
- [x] 2.5 If a new SVG file is selected, submit its text as `seatingSvg` and let the backend sanitize it before saving.
- [x] 2.6 Keep public concert detail behavior intact in `backend/src/modules/concerts/concerts.service.ts` and avoid changing public list behavior.

## 3. Organizer SVG upload UI tasks

- [x] 3.1 Update the organizer concert form in `frontend/src/features/organizer-concerts/components/OrganizerConcertForm.tsx` to use a `.svg` file input as the primary UI for seating maps.
- [x] 3.2 Keep the existing create/update JSON payload structure intact and continue sending `seatingSvg` in the existing organizer concert payload.
- [x] 3.3 Add frontend validation before reading the file:
  - extension must be `.svg`
  - MIME type should be `image/svg+xml` when available
  - size should be limited to a sensible cap such as 200 KB
- [x] 3.4 Use `FileReader` to read the selected SVG file as text.
- [x] 3.5 If no existing sanitizer dependency exists, add DOMPurify to `frontend/package.json`.
- [x] 3.6 Update the organizer form helpers in `frontend/src/features/organizer-concerts/form-helpers.ts` and types in `frontend/src/features/organizer-concerts/types.ts` as needed to support the new upload and preview state.

## 4. Organizer preview and guidance tasks

- [x] 4.1 Sanitize the organizer preview before rendering it in the form so the preview is safe to display.
- [x] 4.2 Do not inject unsanitized SVG into the organizer preview UI.
- [x] 4.3 Show a clear preview state for the uploaded SVG and keep the UI usable for both create and edit flows.
- [x] 4.4 Add helper text explaining that organizers should export SVGs from Figma, Illustrator, or Inkscape.
- [x] 4.5 Add helper text explaining that each zone should use `data-ticket-code`, `data-zone`, or `id` and should match the `TicketType.code` values such as `GA`, `SVIP`, `VIP`, `CAT1`, and `CAT2`.
- [x] 4.6 Do not add a clear/remove map action in this change.

## 5. Edit-flow preservation tasks

- [x] 5.1 In edit mode, if no new SVG file is selected, do not send `seatingSvg` as an empty string.
- [x] 5.2 Preserve the existing stored `Concert.seatingSvg` value when an organizer edits unrelated fields.
- [x] 5.3 If a new SVG file is selected, send its text as `seatingSvg` and let the backend sanitize it.
- [x] 5.4 Avoid accidental overwrite of the existing seating map with `null` or `undefined` during edit operations.

## 6. Audience interactive seat-map tasks

- [x] 6.1 Create a new public component in `frontend/src/features/concerts/components/InteractiveSeatMap.tsx`.
- [x] 6.2 Render the seat map inline SVG, not as an `<img>` element.
- [x] 6.3 Accept `svgMarkup` and `ticketTypes` props.
- [x] 6.4 Sanitize `svgMarkup` with DOMPurify before final render as defense in depth.
- [x] 6.5 Use the same sanitized SVG output for both preview and public rendering; never inject unsanitized SVG anywhere.
- [x] 6.6 Support keyboard focus, hover, and click interactions for SVG zones.
- [x] 6.7 Keep the interaction read-only and do not prefill quantity, alter checkout state, or change order/payment behavior.

## 7. Zone mapping and ticket info tasks

- [x] 7.1 Implement zone detection in the interactive seat-map using the required priority: `data-ticket-code`, then `data-zone`, then `id`.
- [x] 7.2 Normalize both zone codes and `TicketType.code` values by trimming and uppercasing.
- [x] 7.3 Match zones to ticket types when the normalized values align.
- [x] 7.4 Show a graceful fallback such as “Chưa cấu hình vé” when a zone has no matching ticket type.
- [x] 7.5 Keep ticket types without mapped SVG zones visible in the ticket list.
- [x] 7.6 Optionally scroll or highlight the matching TicketTypeCard when a zone is selected.

## 8. Hover/click info panel tasks

- [x] 8.1 When a zone is hovered, focused, or clicked, show ticket-type details in a lightweight info panel.
- [x] 8.2 Display at least: code, name, price, `availableQuantity`, and an availability label based on `availableQuantity`.
- [x] 8.3 Keep the interaction scope limited to highlighting the zone and showing info; do not alter order selection or checkout state.
- [x] 8.4 If a zone has no matching ticket type, show a fallback message instead of crashing.

## 9. Ticket availability polling tasks

- [x] 9.1 Add polling on `frontend/src/features/concerts/pages/ConcertDetailPage.tsx` for `GET /concerts/:id/ticket-types` only.
- [x] 9.2 Do not poll the full concert detail endpoint repeatedly.
- [x] 9.3 Do not refetch seating SVG content repeatedly as part of the polling loop.
- [x] 9.4 Use a 5-second default interval.
- [x] 9.5 Clean up the interval on unmount.
- [x] 9.6 Ignore stale responses if the `concertId` changes.
- [x] 9.7 Keep polling errors non-blocking and avoid crashing the page.
- [x] 9.8 Update the shared `ticketTypes` state so both the ticket list and the seat-map info panel reflect current availability.

## 10. Security and rendering safety tasks

- [x] 10.1 Ensure the frontend uses DOMPurify before both organizer preview rendering and public InteractiveSeatMap rendering.
- [x] 10.2 If `dangerouslySetInnerHTML` is used, only pass sanitized SVG output to it.
- [x] 10.3 Do not inject unsanitized SVG anywhere in the app.
- [x] 10.4 Preserve only the safe SVG tags and attributes required for seating maps and zone mapping.

## 11. Tests and manual verification tasks

- [x] 11.1 Add backend tests for the concert save flow covering valid SVG upload persistence.
- [x] 11.2 Add backend tests for empty/trimmed-empty SVG rejection.
- [x] 11.3 Add backend tests for oversized SVG rejection.
- [x] 11.4 Add backend tests for malformed/non-SVG-like rejection.
- [x] 11.5 Add backend tests for dangerous-content rejection.
- [x] 11.6 Add frontend tests for organizer file upload and payload submission.
- [x] 11.7 Add frontend tests for edit-mode preservation of existing seating SVG when no new file is selected.
- [x] 11.8 Add frontend tests for InteractiveSeatMap zone mapping and fallback behavior.
- [x] 11.9 Manually verify a valid SVG upload succeeds.
- [x] 11.10 Manually verify a malicious SVG is rejected by the backend.
- [x] 11.11 Manually verify the audience detail page shows an interactive seating map and updated availability without changing checkout behavior.

## 12. Build, lint, and verification tasks

- [x] 12.1 Run backend tests and lint checks for the concert-related modules.
- [x] 12.2 Run frontend tests, typecheck, and lint checks for the organizer form and concert detail experience.
- [x] 12.3 Confirm the change does not alter checkout, order, payment, or check-in behavior.

## 13. Explicit out-of-scope constraints

- [x] 13.1 Do not use MinIO for seating SVG.
- [x] 13.2 Do not store seating SVG as a URL.
- [x] 13.3 Do not render seating SVG with `<img>`.
- [x] 13.4 Do not add WebSocket or SSE.
- [x] 13.5 Do not change checkout, order, payment, or check-in behavior.
- [x] 13.6 Do not render full seating SVG on the public concert list.
- [x] 13.7 Do not add seat-level booking.
- [x] 13.8 Do not build an in-app SVG editor.
- [x] 13.9 Do not implement application code in this change; this task list is for planning and implementation readiness only.
