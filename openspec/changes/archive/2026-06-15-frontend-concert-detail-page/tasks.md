## 1. Feature Setup

- [x] 1.1 Create type definition file: `frontend/src/features/concerts/types.ts` extending with `ConcertDetail` and `TicketType` interfaces matching backend DTOs (id, title, artistName, description, venueName, venueAddress, bannerUrl, seatingSvg, startsAt, endsAt for detail; id, code, name, priceVnd, totalQuantity, availableQuantity, perUserLimit, saleStartAt, saleEndAt for ticket type).
- [x] 1.2 Extend API client file: `frontend/src/features/concerts/api.ts` with `getConcertDetail(id)` and `getConcertTicketTypes(id)` functions using `apiFetch`; reuse existing `formatConcertDate()`; keep existing `formatPrice()` for concert list minimum price; add `formatVnd(priceVnd)` for exact ticket type prices without the "Từ" prefix.
- [x] 1.3 Verify `npm run typecheck` and `npm run lint` pass without errors.

## 2. Concert Detail Page Component

- [x] 2.1 Create page component: `frontend/src/features/concerts/pages/ConcertDetailPage.tsx` with state for concertDetail, ticketTypes, isLoading, error, notFound.
- [x] 2.2 Implement `useEffect` to fetch route param `id` from `useParams<{ id: string }>()` and fetch both APIs in parallel using `Promise.all([getConcertDetail(id), getConcertTicketTypes(id)])` with cleanup flag for race condition prevention.
- [x] 2.3 Implement error handling: 404 from either endpoint → `setNotFound(true)`; other errors, including invalid id, network errors, and server errors → `setError(err)`.
- [x] 2.4 Implement retry handler: clears error and not-found, re-fetches both APIs.
- [x] 2.5 Add loading state UI: centered text "Đang tải thông tin sự kiện...".
- [x] 2.6 Add not-found state UI: "Sự kiện không tồn tại" (no retry button).
- [x] 2.7 Add error state UI: `Alert` component with error message + "Thử lại" button.

## 3. Concert Detail Rendering

- [x] 3.1 Render concert banner: reuse image logic from `ConcertCard` (handle `bannerUrl`, show empty state if null or fails to load).
- [x] 3.2 Render concert metadata: title, artistName (if present), venueName, venueAddress (if present), formatted startsAt using `formatConcertDate()`.
- [x] 3.3 Render description: show `concertDetail.description` if present (render as text block).
- [x] 3.4 Render seating map section: if `seatingSvg` exists, render using `dangerouslySetInnerHTML` with clear XSS warning comment noting backend-controlled SVG and future sanitization requirement; if null, show placeholder "Chưa có sơ đồ chỗ ngồi".

## 4. Ticket Types Component

- [x] 4.1 Create component: `frontend/src/features/concerts/components/TicketTypeCard.tsx` with props `ticketType: TicketType`.
- [x] 4.2 Render ticket type name and code: display as heading "{name} ({code})".
- [x] 4.3 Render price: use `formatVnd(ticketType.priceVnd)` so ticket type price displays as exact VND price, for example "800.000 ₫", not "Từ 800.000 ₫".
- [x] 4.4 Render availability: if `availableQuantity > 0` show "Còn {availableQuantity} vé"; if `availableQuantity === 0` show "Hết vé" badge.
- [x] 4.5 Render per-user limit: display "Max {perUserLimit} vé/người".
- [x] 4.6 Render sale period: format `saleStartAt` and `saleEndAt` using `formatConcertDate()`; show "saleStartAt — saleEndAt" or "saleStartAt — Không giới hạn" if `saleEndAt` is null.
- [x] 4.7 Render button: "Chọn vé" button disabled and display-only (no click handler, visually greyed out).
- [x] 4.8 Style ticket type card as vertical card/row (not grid), with flex layout, padding, subtle border and shadow.

## 5. Ticket Types List

- [x] 5.1 In `ConcertDetailPage`, render ticket types section with header "HẠNG VÉ HIỆN CÓ".
- [x] 5.2 If `ticketTypes.length === 0`, show "Chưa có hạng vé đang mở bán." (no render of ticket list).
- [x] 5.3 Otherwise, render list of `TicketTypeCard` components, one for each ticket type.
- [x] 5.4 Ensure cards are displayed vertically (full width on mobile, tablet, desktop).

## 6. Routing

- [x] 6.1 Update router: `frontend/src/app/router.tsx` to add route `<Route path="/concerts/:id" element={<ConcertDetailPage />} />` after `/concerts` route.
- [x] 6.2 Verify `npm run typecheck` and `npm run lint` pass.

## 7. Styling

- [x] 7.1 Add CSS classes to `frontend/src/styles.css`: `.concert-detail-page`, `.concert-detail-container`, `.concert-header`, `.concert-info`, `.concert-description`, `.concert-seatmap`, `.concert-seatmap-placeholder`, `.concert-tickets-section`, `.ticket-types-list`, `.ticket-type-card`, `.ticket-type-card--sold-out`, `.ticket-type-card-button` (disabled state).
- [x] 7.2 Ensure all elements inherit from design system variables (colors, shadows, typography).
- [x] 7.3 Ensure responsive layout: mobile-first, scaling appropriately for tablet and desktop.
- [x] 7.4 Verify `npm run lint` passes.

## 8. Verification

- [x] 8.1 Run the smallest available validation commands, preferably `npm run typecheck`, `npm run lint`, and `npm run build` if scripts exist.
- [x] 8.2 Verify no hard-coded backend URLs are added; API calls must use existing `apiFetch` / `VITE_API_BASE_URL` convention.
- [x] 8.3 Verify `/concerts/:id` route is registered and all new files are in the correct locations.
- [x] 8.4 Developer will manually test browser behavior: loading, error, not found, empty tickets, seating map, responsive layout, and disabled ticket button.
