## Context

The current organizer form renders a banner preview image directly with a class that does not appear to constrain width or max-width, and the seating SVG preview is injected into a wrapper without responsive sizing rules. On the public concert detail page, the banner uses a card banner class and the public seat-map uses a container with an SVG child. The likely cause is a missing responsive CSS layer for both media types rather than any upload or storage issue.

## Goals / Non-Goals

**Goals:**

- Make banner preview images and seating SVG previews fit the available layout width.
- Prevent horizontal overflow in the organizer form and public concert detail page.
- Preserve aspect ratio and visual design as much as possible.
- Keep the fix limited to frontend CSS/component-level changes.

**Non-Goals:**

- No backend changes.
- No API payload changes.
- No upload/storage changes.
- No sanitizer changes.
- No checkout/order/payment/check-in changes.
- No reintroduction of interactive seat-map behavior.

## Decisions

- Keep the fix frontend-only and CSS/component-oriented.
- Apply responsive rules to organizer banner preview images and organizer seating SVG preview wrappers/inline SVGs.
- Apply the same responsive guard to public concert detail banner rendering and public seat-map SVG rendering where relevant.
- Leave existing media semantics and upload behavior unchanged.

## Risks / Trade-offs

- [Over-constraining the media could distort the existing card layout] → Mitigation: preserve aspect ratio with max-width and height:auto while leaving the existing card structure intact.
- [Inline SVGs may need container-level overflow handling] → Mitigation: use wrapper-level max-width and overflow handling together with SVG-level width/height rules.
- [Visual design may need minor adjustment] → Mitigation: keep the change minimal and focused on containment rather than redesign.
