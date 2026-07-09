## 1. Feature Setup

- [x] 1.1 Create directory structure: `frontend/src/features/concerts/` with subdirectories `pages/` and `components/`.
- [x] 1.2 Create type definition file: `frontend/src/features/concerts/types.ts` with `Concert` interface matching backend response (id, title, artistName, description, venueName, venueAddress, bannerUrl, startsAt, endsAt, minPriceVnd).
- [x] 1.3 Create API client file: `frontend/src/features/concerts/api.ts` with `getConcerts()` function using `apiFetch`, and formatters `formatConcertDate()` (vi-VN locale, Asia/Ho_Chi_Minh timezone) and `formatPrice()` (VND format, null → "Đang cập nhật").
- [x] 1.4 Verify `npm run typecheck` and `npm run lint` pass without errors.

## 2. Concert List Implementation

- [x] 2.1 Create component: `frontend/src/features/concerts/components/ConcertCard.tsx` displaying banner, title, artist, venue, date, price, and "Xem chi tiết" button; clicking navigates to `/concerts/:id`.
- [x] 2.2 Create page component: `frontend/src/features/concerts/pages/ConcertsListPage.tsx` with state for concerts, loading, and error; fetch data in `useEffect`; render loading/error/empty/grid states.
- [x] 2.3 Add loading state UI: centered text or spinner (no skeleton in MVP).
- [x] 2.4 Add error state UI: alert with error message and "Thử lại" button to retry.
- [x] 2.5 Add empty state UI: message "Không có concert nào hiện tại."
- [x] 2.6 Implement retry handler: clears error, re-fetches data from API.

## 3. Routing and Styling

- [x] 3.1 Update router: `frontend/src/app/router.tsx` to add `/concerts` route pointing to `ConcertsListPage`; redirect `/` and `/home` to `/concerts`; update catch-all to redirect to `/concerts`.
- [x] 3.2 Add CSS classes to `frontend/src/styles.css`: `.concerts-page`, `.concerts-container`, `.concerts-grid` with responsive layout (1 col mobile, 2 cols at 768px, 3 cols at 1024px).
- [x] 3.3 Add concert card CSS: `.concert-card`, `.concert-card-banner`, `.concert-card-banner-empty` (fallback when `bannerUrl` is null), `.concert-card-content`, `.concert-card-title`, `.concert-card-artist`, `.concert-card-venue`, `.concert-card-meta`, `.concert-card-action`.
- [x] 3.4 Add state CSS: `.concerts-loading`, `.concerts-error`, `.alert--danger`, `.alert-action`, `.concerts-empty`.
- [x] 3.5 Verify `npm run lint` passes; frontend still compiles.

## 4. Verification

- [x] 4.1 Verify no hard-coded backend URL in component code; `VITE_API_BASE_URL` used via `lib/config.ts`.
- [x] 4.2 Run `npm run typecheck`, `npm run lint`, `npm run build` — all pass without errors.
