## 1. Reproduce and Inspect the Save/Reload Path

- [x] 1.1 Reproduce or confirm that the SVG renders correctly before save but becomes clipped or blank after save/reload.
- [x] 1.2 Compare the original SVG text, the frontend preview output, the backend sanitized output, and the reloaded Concert.seatingSvg value.
- [x] 1.3 Identify whether viewBox is rewritten to viewbox or removed during the sanitize/save flow.
- [x] 1.4 Inspect backend/src/modules/concerts/svg-sanitizer.ts.
- [x] 1.5 Inspect the organizer save path in backend/src/modules/concerts/organizer-concerts.service.ts.

## 2. Sanitizer Fix

- [x] 2.1 Stop blindly lowercasing emitted SVG attribute names.
- [x] 2.2 Allow case-insensitive matching internally if needed.
- [x] 2.3 Preserve the correct emitted casing for SVG attributes, especially viewBox and preserveAspectRatio.
- [x] 2.4 Preserve safe root/layout attributes: xmlns, width, height, viewBox, preserveAspectRatio.
- [x] 2.5 Preserve safe shape attributes: x, y, width, height, d, points, cx, cy, r, rx, ry, transform, fill, stroke, stroke-width, opacity.
- [x] 2.6 Preserve safe text attributes: font-size, font-weight, text-anchor, dominant-baseline.
- [x] 2.7 Preserve safe mapping attributes: id, class, data-zone, data-ticket-code.
- [x] 2.8 Preserve safe text nodes inside <text>.

## 3. Security Must Remain

- [x] 3.1 Still reject/remove script.
- [x] 3.2 Still reject/remove foreignObject.
- [x] 3.3 Still reject/remove event handler attributes such as onclick, onload, and onmouseover.
- [x] 3.4 Still reject/remove javascript: URLs.
- [x] 3.5 Still reject/remove unsafe href / xlink:href.
- [x] 3.6 Do not loosen the sanitizer to allow arbitrary style.

## 4. Regression Tests

- [x] 4.1 Add backend tests to ensure viewBox remains viewBox, not viewbox.
- [x] 4.2 Add backend tests to ensure preserveAspectRatio remains preserved when present.
- [x] 4.3 Add backend tests to ensure font-size, text-anchor, and dominant-baseline are preserved.
- [x] 4.4 Add backend tests to ensure dangerous content is still rejected/removed.
- [x] 4.5 Add backend tests to ensure organizer create/update stores the corrected sanitized SVG.
- [x] 4.6 Add backend tests to ensure the saved SVG still contains a complete <svg ...>...</svg> after sanitization.

## 5. Verification

- [x] 5.1 Run backend sanitizer/concert service tests.
- [ ] 5.2 Run backend build/lint if code is touched.
- [ ] 5.3 Run frontend build/test only if frontend files are touched.
- [ ] 5.4 Manually verify that a sample uploaded SVG renders correctly after save/reload.

## 6. Out of Scope

- [x] No storage architecture changes.
- [x] No MinIO.
- [x] No SVG URL storage.
- [x] No <img> rendering.
- [x] No checkout/order/payment/check-in changes.
- [x] No frontend redesign unless needed for verification.
- [x] No reintroducing interactive zone behavior.
