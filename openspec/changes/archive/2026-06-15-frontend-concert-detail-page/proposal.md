# Proposal: Frontend — Concert Detail Page

## Context

The frontend currently displays a public concerts list page (`/concerts`) with concert cards showing title, artist, venue, date, and minimum price. Users can click a card to navigate to `/concerts/:id`, but that route is not yet implemented.

The backend has three public concert APIs:

- `GET /concerts` — list of published concerts (already integrated)
- `GET /concerts/:id` — full concert detail with metadata and seating SVG
- `GET /concerts/:id/ticket-types` — list of active ticket types with pricing and availability

**Gap**: The frontend `/concerts/:id` page does not exist. Users cannot view concert details or available ticket types.

## Goals

**Goals:**

- Create a `/concerts/:id` detail page displaying comprehensive concert information
- Fetch and display concert metadata (title, artist, venue, date, description, banner)
- Fetch and display seating map SVG from backend
- Fetch and display available ticket types with pricing, availability, sale period, and limits
- Show loading, error, retry, and not-found states
- Follow existing frontend conventions (React, React Router, `apiFetch`, feature-based structure)

**Non-Goals:**

- Implementing ticket quantity selection
- Creating orders or checkout
- Payment processing
- Authentication or access control
- Real-time updates or live availability
- Admin/seller views

## Scope

**Frontend only** — Integrate two additional backend concert APIs into a new detail page component.

### Included:

- New route: `GET /concerts/:id` page component
- API client functions: `getConcertDetail(id)` and `getConcertTicketTypes(id)`
- Type definitions for `ConcertDetail` and `TicketType`
- Page component with dual-API parallel fetching
- Seating map SVG rendering (backend-controlled, with XSS warning comment)
- Ticket types display as vertical cards/rows with full details
- Loading, error, retry, and not-found states
- Formatted date/time (vi-VN locale, Asia/Ho_Chi_Minh timezone)
- Formatted prices (Vietnamese dong)

### Out of scope:

- Ticket selection UI
- Order creation (`POST /orders`)
- Payment flow
- Admin concert management
- Searching or filtering concerts
- Wishlist or favorites

## Decisions

1. **Parallel API fetching**: Use `Promise.all()` to fetch concert detail and ticket types concurrently
   - Rationale: Faster than sequential; detail page is unusable without both pieces of data

2. **Error handling strategy**:
   - 404 from either endpoint → "Sự kiện không tồn tại" (not found state)
   - Other errors (5xx, timeout) → Error alert with retry button
   - Rationale: Clear UX distinction between missing concert vs. transient errors

3. **Seating SVG rendering**: Use `dangerouslySetInnerHTML` with code comment warning
   - SVG is backend-generated and controlled (safe for MVP)
   - If SVG ever becomes user-uploaded, must add sanitization (DOMPurify or similar)
   - Rationale: Simplest approach; backend controls content; comment flags future security concern

4. **Ticket type display**: Vertical cards/rows layout, not grid
   - Shows all fields: name, code, price, available quantity, per-user limit, sale period
   - Rationale: Sequential reading preferred for detailed info; sale period is multi-line

5. **Empty states**:
   - No ticket types → "Chưa có hạng vé đang mở bán."
   - Ticket sold out → Show "Hết vé" badge and disable button
   - No seating map → "Chưa có sơ đồ chỗ ngồi" placeholder
   - Rationale: Clear communication of concert state to user

6. **Reuse existing conventions**: Use `apiFetch`, formatters, `Alert`, `Button` from established patterns
   - Rationale: Consistency, faster development, lower maintenance

## Trade-offs & Risks

| Risk                                  | Mitigation                                                                    |
| ------------------------------------- | ----------------------------------------------------------------------------- |
| Backend URL mismatch                  | Use existing `VITE_API_BASE_URL` env var (same as list page)                  |
| Concurrent fetch error handling       | Both fail together; not partial state (simpler)                               |
| SVG XSS vulnerability                 | Comment in code flags concern; backend currently safe but document for future |
| 404 from one endpoint → partial data  | Treat any 404 as concert not found; no fallback                               |
| User expects "select quantity" button | Button is disabled; design clearly shows MVP limitation                       |

## Success Criteria

- [ ] `/concerts/:id` route renders concert detail page
- [ ] Concert metadata displayed: title, artist, venue, address, date, description, banner
- [ ] Seating SVG rendered (or placeholder if null) with XSS warning comment
- [ ] Ticket types fetched and displayed as vertical cards
- [ ] Each ticket card shows: code, name, price (formatted VND), available qty, per-user limit, sale period
- [ ] Sold-out tickets show "Hết vé" badge with disabled button
- [ ] Empty ticket list shows "Chưa có hạng vé đang mở bán."
- [ ] Loading state shown during fetch
- [ ] 404 → "Sự kiện không tồn tại"
- [ ] Errors → Alert + retry button
- [ ] Date/time formatted as Vietnamese locale, Asia/Ho_Chi_Minh timezone
- [ ] Prices formatted as Vietnamese dong (VND)
- [ ] Button labeled "Chọn vé" is display-only and disabled
- [ ] No hard-coded backend URLs
- [ ] Existing frontend conventions followed (React, Router, `apiFetch`, component structure)
- [ ] TypeScript types match backend DTOs
- [ ] Frontend builds and runs without errors
