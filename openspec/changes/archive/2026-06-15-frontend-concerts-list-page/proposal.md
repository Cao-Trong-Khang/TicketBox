# Proposal: Frontend — Public Concerts List Page

## Context

The backend has recently implemented public concert APIs:

- `GET /concerts` — list all published concerts with basic metadata
- `GET /concerts/:id` — concert detail (not in scope)
- `GET /concerts/:id/ticket-types` — ticket types (not in scope)

The frontend currently has:

- React 19 + React Router DOM 7 application
- Centralized `apiFetch()` wrapper for API calls
- Auth shell with navbar, login/register pages
- AppShell layout component
- Global CSS design system with Vietnamese styling

**Gap**: There is no public-facing page to browse and discover concerts. Users cannot see the list of upcoming performances.

## Goals

**Goals:**

- Create a public `/concerts` page displaying a responsive grid of concert cards
- Each card shows concert banner, title, artist, venue, date/time, and minimum price
- Format dates in Vietnamese locale with `Asia/Ho_Chi_Minh` timezone
- Format prices in Vietnamese dong (VND) with proper formatting
- Add loading, error, retry, and empty states for good UX
- Support navigation to concert detail page (`/concerts/:id`)

**Non-Goals:**

- Implementing the concert detail page in this task
- Adding authentication or login flow
- Implementing ticket selection, ordering, or payment
- Redesigning the app UI or theme

## Scope

**Frontend only** — Integrate existing backend concert APIs into a new feature module.

### Included:

- New feature folder: `src/features/concerts/`
- API client function: `getConcerts()`
- Type definitions for Concert response
- ConcertsListPage component with state management
- ConcertCard component to display individual concerts
- Responsive grid layout (mobile/tablet/desktop)
- Error handling and retry logic
- Fallback for missing images

### Out of scope:

- Detail page (`/concerts/:id` — will be 404 for now)
- Search, filtering, or sorting by price/date
- Favorites or wishlist
- Auth-protected endpoints
- Analytics or event tracking

## Decisions

1. **Route**: `/concerts` as the main public concerts list route
   - Redirect `/` and `/home` to `/concerts` temporarily
   - The concert list becomes the default landing page for now

2. **API convention**: Use existing `apiFetch()` + `VITE_API_BASE_URL`
   - No hard-coded backend URL in components
   - Follows established pattern from auth module

3. **Component structure**: Feature-based organization
   - `src/features/concerts/api.ts` — API client
   - `src/features/concerts/types.ts` — TypeScript types
   - `src/features/concerts/pages/ConcertsListPage.tsx` — Main page
   - Optional: `src/features/concerts/components/ConcertCard.tsx` — Card UI

4. **Styling**: Global CSS classes + inline responsive styles
   - Extend `src/styles.css` for concert-specific layout
   - No new UI library or CSS-in-JS
   - Follow existing design system (CSS variables, semantic class names)

5. **Formatting**:
   - Date/time: `Intl.DateTimeFormat` with `vi-VN` locale, `Asia/Ho_Chi_Minh` timezone
   - Price: Vietnamese locale number formatting with `₫` symbol
   - Null handling: `artistName` and `venueAddress` optional, `bannerUrl` uses fallback color

6. **Navigation**: Click card → navigate to `/concerts/:id`
   - Use React Router `useNavigate()` hook
   - Detail page will return 404 until implemented

## Trade-offs & Risks

| Risk                    | Mitigation                                                                               |
| ----------------------- | ---------------------------------------------------------------------------------------- |
| Backend API not running | Default `VITE_API_BASE_URL` points to `http://localhost:3000`; ensure backend is started |
| CORS issue              | Verify backend allows `http://localhost:5173` in CORS policy                             |
| Image 404               | Use CSS fallback (background color + placeholder text) instead of broken image           |
| Timezone mismatch       | Fix timezone to `Asia/Ho_Chi_Minh` in formatter; no user-configurable tz for MVP         |
| Empty state UX          | Clearly indicate "Không có concert nào" instead of blank screen                          |
| Network errors          | Show error alert with "Thử lại" button; allow manual retry                               |

## Success Criteria

- [ ] `/concerts` displays a list of concerts fetched from backend
- [ ] Each concert shows all required fields (title, artist, venue, date, price)
- [ ] Date formatted as Vietnamese locale with correct timezone
- [ ] Price formatted in VND; null price shows "Đang cập nhật"
- [ ] Grid is responsive: 1 col mobile, 2 cols tablet, 3 cols desktop
- [ ] Loading state displayed while fetching
- [ ] Error state with retry button on API failure
- [ ] Empty state when zero concerts available
- [ ] Clicking a concert card navigates to `/concerts/:id`
- [ ] Missing banner images show fallback gracefully
- [ ] Frontend app builds and runs without errors
- [ ] No hard-coded backend URL in component code
