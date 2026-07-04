## Context

TicketBox already stores a Concert.seatingSvg field and exposes it on the public concert detail API, but the current implementation is effectively raw markup plumbing. Organizer users can only work with textual SVG content in the form, and the audience detail page injects that markup directly with dangerouslySetInnerHTML. The new change must introduce a safer upload experience, server-side sanitization, and an interactive zone-aware rendering view without changing checkout or inventory semantics.

## Goals / Non-Goals

**Goals:**

- Let organizers upload a seating map as an SVG file during concert create or edit.
- Preserve existing concert payload structures by sending seatingSvg as text through the current create/update API.
- Sanitize and validate SVG content on the backend before persistence.
- Render a sanitized inline SVG on the public concert detail page with zone hover/focus/click interactions.
- Keep ticket availability updates fresh through polling while leaving checkout and payment flows unchanged.

**Non-Goals:**

- In-app SVG editing.
- Seat-level booking or zone-level reservation beyond the existing ticket-type model.
- Storing seating SVG as a URL or as a banner asset.
- WebSocket or SSE-based live updates.
- Changes to payment, order, ticket issuance, or check-in behavior.
- Rendering full seat maps on the public concert list.

## Decisions

- Use the existing Concert.seatingSvg column as the single source of truth and keep the data as sanitized SVG text in PostgreSQL.
  - Rationale: This aligns with the current domain model and avoids introducing new storage or URL-based asset workflows.
  - Alternative considered: storing the SVG as a file object in object storage. Rejected because the current architecture already uses Concert.seatingSvg and the feature requires inline interactive rendering.

- Apply sanitization in the backend organizer save path for both create and update operations.
  - Rationale: Backend validation is the authoritative safeguard and prevents unsafe SVG from being persisted even if the frontend is bypassed.
  - Alternative considered: relying only on frontend validation. Rejected because the backend must remain the trust boundary.

- Use a whitelist-based sanitizer for SVG tags and attributes that support normal zone-based maps.
  - Rationale: The feature needs safe rendering of shapes, text, and metadata attributes like data-ticket-code and data-zone without allowing scripts or event handlers.
  - Alternative considered: allowing arbitrary SVG markup. Rejected due to XSS and script injection risk.

- Render the audience map inline as SVG and keep interaction read-only.
  - Rationale: Inline SVG is required for hover, focus, and click behavior by zone and avoids the limitations of image rendering.
  - Alternative considered: rendering the SVG as an image element. Rejected because it does not support interactive zone mapping.

- Use polling for ticket availability updates on the concert detail page.
  - Rationale: The existing public ticket-type API already supports short-lived caching and cache invalidation on order changes, and polling is simpler than introducing a new realtime channel.
  - Alternative considered: WebSocket/SSE. Rejected because the change explicitly avoids realtime infrastructure and the current architecture already supports polling-based freshness.

## Risks / Trade-offs

- [SVG compatibility] → Some organizers may export SVGs with attributes or structure that the sanitizer rejects; the UI should explain the allowed convention and the backend should return clear validation errors.
- [Zone mapping ambiguity] → If organizers do not use consistent zone identifiers, the interactive map may not match ticket types; helper text and validation guidance will reduce this risk.
- [Stale availability display] → Polling can briefly show outdated counts; the design will use a short interval, stale-response protection, and non-blocking error handling.
- [Frontend rendering safety] → Even with backend sanitization, the frontend must sanitize again before display as defense in depth.

## Migration Plan

- This change is additive and uses the existing Concert.seatingSvg column; no schema migration is required.
- Existing concerts without a seating map continue to work unchanged.
- Existing organizer and public concert APIs remain compatible, with the new behavior layered on top of the current payloads.
- Rollback is straightforward because the change only affects how seatingSvg is validated, stored, and rendered.

## Open Questions

- Should the organizer form include only a file upload UI, or should a simple textarea fallback remain visible for advanced users?
- Should the interactive map panel show a compact legend or tooltip structure for zone details, or is a simple info panel sufficient for the initial release?
