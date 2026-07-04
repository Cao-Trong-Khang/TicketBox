## 1. Reproduce and Inspect the Current Layout Behavior

- [x] 1.1 Reproduce or confirm that a large banner image preview breaks the organizer form layout.
- [x] 1.2 Reproduce or confirm that a large seating SVG preview/display can overflow the organizer form or page layout.
- [x] 1.3 Inspect the organizer banner preview component and CSS in frontend/src/features/organizer-concerts/components/OrganizerConcertForm.tsx and frontend/src/styles.css.
- [x] 1.4 Inspect the organizer seating SVG preview component and CSS in frontend/src/features/organizer-concerts/components/OrganizerConcertForm.tsx and frontend/src/styles.css.
- [x] 1.5 Inspect public concert detail banner and SVG rendering in frontend/src/features/concerts/pages/ConcertDetailPage.tsx, frontend/src/features/concerts/components/InteractiveSeatMap.tsx, and frontend/src/styles.css.

## 2. Implement Responsive Media Containment

- [x] 2.1 Add responsive image CSS for banner previews/renders so they fit within available layout width.
- [x] 2.2 Add responsive inline SVG CSS for seating map previews/renders so they fit within available layout width.
- [x] 2.3 Preserve aspect ratio for both banner images and seating SVGs.
- [x] 2.4 Prevent horizontal overflow in the organizer form and public concert detail page.

## 3. Preserve Existing Behavior

- [x] 3.1 Do not change backend behavior.
- [x] 3.2 Do not change upload/storage behavior.
- [x] 3.3 Do not change API payloads.
- [x] 3.4 Do not change sanitizer behavior.
- [x] 3.5 Do not change checkout/order/payment/check-in behavior.
- [x] 3.6 Do not reintroduce interactive seating map behavior.

## 4. Verification

- [x] 4.1 Run frontend build.
- [x] 4.2 Run frontend lint.
- [x] 4.3 Run relevant frontend tests: OrganizerConcertForm.test.tsx and ConcertDetailPage.test.tsx.
- [x] 4.4 Manually verify behavior with a very large banner image and a large SVG.
