## Context

TicketBox already has the core data needed for organizer concert cards: PostgreSQL `concerts` records store `banner_url`, `venue_name`, `venue_address`, status, and timing fields, and the frontend already has a buyer-facing `ConcertCard` pattern for public concert browsing. The current gap is that the organizer dashboard still renders a separate stacked list style and the organizer list API does not return the full card metadata needed to match that visual pattern.

This change stays inside the existing Client-Server and layered NestJS architecture. The Web Application organizer area will keep calling the Backend API over the existing `GET /organizer/concerts` endpoint, and PostgreSQL remains the source of truth for organizer-owned concert metadata. No Redis, Kafka, worker, or external integration changes are required because the feature is a presentation and response-shape refinement for organizer-owned concert browsing.

## Goals / Non-Goals

**Goals:**
- Return enough organizer-owned concert metadata from `GET /organizer/concerts` to render organizer cards with the real concert banner and full venue/location text.
- Update the organizer dashboard UI so owned concerts appear as cards that closely match the audience-facing concert card layout.
- Preserve the existing organizer edit route and cancel flow while making the footer organizer-specific with only `Sửa` and `Hủy`.
- Keep the current RBAC and ownership behavior unchanged so organizers still see only their own concerts and can act only within existing business rules.

**Non-Goals:**
- No changes to concert create or edit form behavior.
- No changes to cancel business rules, order flow, payment flow, ticket selection, or check-in behavior.
- No changes to audience list behavior or the public `Xem chi tiết` interaction.
- No new database tables, cache layers, background jobs, or external services.

## Decisions

### 1. Expand the organizer concert list payload with `bannerUrl` and `venueAddress`

The organizer dashboard cannot render banner-led cards that match the audience view unless `GET /organizer/concerts` returns the same essential display fields. `Concert.bannerUrl` and `Concert.venueAddress` already exist in PostgreSQL and are already exposed in other organizer/public concert responses, so the lowest-risk change is to extend the list DTO, Prisma select, and response mapping instead of creating a second organizer detail fetch per card.

Alternatives considered:
- Keep the existing list payload and render placeholders: rejected because the product requirement explicitly requires the real banner image.
- Fetch organizer detail per card to get `bannerUrl`: rejected because it adds extra client requests and duplicates data already available in the list query.

### 2. Create an organizer-specific card component that matches the audience card visually

The audience `ConcertCard` is the visual reference, but its behavior is audience-specific because it shows price information and the `Xem chi tiết` action. The organizer dashboard needs the same banner-first layout while preserving organizer-only actions and lifecycle status. The safest approach is to create an organizer-specific card component that reuses the same styling language and content hierarchy without directly repurposing the public card.

Alternatives considered:
- Reuse `ConcertCard` directly with conditional props: rejected because it increases the chance of public-page regression and leaves the component responsible for two different footer behaviors.
- Extract a shared base card immediately: deferred because the scope is small and the safest short-term path is to keep the public card stable while introducing a new organizer card that deliberately mirrors it.

### 3. Keep organizer actions and protection rules unchanged

`Sửa` continues to navigate to the existing organizer edit route, and `Hủy` continues to call the existing organizer cancel flow. The frontend card only changes presentation; all access-control checks remain in the existing Backend API through JWT authentication, organizer role validation, and organizer ownership checks in `OrganizerConcertsService`.

Alternatives considered:
- Add a new organizer detail view button: rejected because the requirement explicitly says the organizer card footer must not render `Xem chi tiết`.
- Introduce new organizer actions from the dashboard: rejected because they are outside this focused change.

### 4. Limit styling changes to organizer dashboard-specific classes or clearly shared layout primitives

The public audience page must not regress. Styling should therefore be introduced either through a new organizer card class set or through narrowly scoped shared primitives that do not alter the rendered behavior of the existing `ConcertCard`. Responsive behavior should match the audience grid pattern, but public selectors should stay stable unless a change is demonstrably safe.

Alternatives considered:
- Rewrite the audience and organizer cards together: rejected because it expands the blast radius and is unnecessary for this targeted UI alignment change.

## Risks / Trade-offs

- **[Organizer list response grows slightly]** → Mitigation: only add `bannerUrl` and `venueAddress`, both of which are already persisted fields and do not require joins or new storage.
- **[Organizer card drifts from audience card over time]** → Mitigation: use the existing audience card as the visual reference and keep the organizer card content hierarchy intentionally parallel.
- **[Public audience card regression if styles are over-shared]** → Mitigation: keep public `ConcertCard` behavior unchanged and scope organizer dashboard styling carefully.
- **[Mobile layout becomes cramped with badge plus two actions]** → Mitigation: design the organizer footer for wrap behavior and verify mobile rendering explicitly.
- **[Spec and implementation mismatch on list fields persists]** → Mitigation: update the organizer list DTO, backend tests, and frontend types together in the same change.

## Migration Plan

1. Extend the backend organizer list DTO, query select, and mapper to include `bannerUrl` and `venueAddress`.
2. Update frontend organizer types to consume the expanded list response.
3. Introduce the organizer-specific concert card and switch the organizer dashboard from stacked list layout to responsive card grid.
4. Verify existing edit navigation and cancel flow still work without changing route structure or backend mutation behavior.
5. Run backend and frontend test/build/lint checks.

Rollback is straightforward: revert the organizer dashboard rendering and remove the added list fields from the DTO/mapping if needed. No schema or data migration is involved.

## Open Questions

- None at the feature level after the latest product clarification. The banner image is required, `venueAddress` is included for parity, and the organizer footer must show only `Sửa` and `Hủy`.
