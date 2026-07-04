## Context

The organizer seating SVG flow currently works in two stages: the front-end preview sanitizes the uploaded SVG for display, and the backend sanitizer reprocesses the markup again before saving it to the concert record. The bug report indicates that the saved SVG no longer renders the same way as the preview, which points to a lossy transformation in the backend save path rather than the original file itself.

The current backend sanitizer is a regex-based rewrite that lowercases attribute names and reconstructs tags. That makes it a likely source of layout regressions for SVGs that depend on attributes such as viewBox, width, height, and text-positioning values.

## Goals / Non-Goals

**Goals:**

- Preserve layout-critical SVG semantics through the backend sanitize-and-save path.
- Keep the organizer preview and the saved public rendering visually consistent.
- Maintain the existing sanitization security model while avoiding regressions in seat-map display.

**Non-Goals:**

- No storage architecture changes.
- No MinIO or SVG URL storage.
- No checkout, order, payment, or check-in changes.
- No switch to image-based rendering.
- No public-detail redesign.

## Decisions

- Keep the existing backend sanitization approach but make it preserve layout-critical SVG attributes instead of rewriting them in a way that breaks rendering.
- Preserve the current security posture by continuing to block dangerous tags and event handlers while allowing safe SVG layout and text attributes.
- Keep the frontend rendering model unchanged unless inspection proves the public rendering component is also responsible for the regression.
- Add focused regression coverage around the sanitize-and-save behavior so future SVG updates do not silently regress.

## Risks / Trade-offs

- [Overly permissive sanitization could reintroduce XSS risk] → Mitigation: continue blocking unsafe tags, event handlers, and javascript URLs while only expanding the attribute allowlist for layout-safe SVG values.
- [A parser-based sanitizer may be more robust but more invasive] → Mitigation: prefer a minimal, targeted preservation fix first, and only consider a parser-based approach if the current whitelist-preserving rewrite remains insufficient.
- [Some SVGs may rely on attributes not yet covered by the allowlist] → Mitigation: preserve the documented layout and text attributes most commonly used in seat-map SVGs and verify the result with regression tests.
