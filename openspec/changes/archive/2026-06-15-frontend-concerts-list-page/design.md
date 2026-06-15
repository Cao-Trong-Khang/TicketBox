# Design: Frontend — Public Concerts List Page

## Architecture Overview

The concerts feature follows the established frontend structure:

```
src/
├── features/concerts/
│   ├── api.ts                  # API client functions
│   ├── types.ts                # TypeScript interfaces
│   ├── pages/
│   │   └── ConcertsListPage.tsx   # Main page component
│   └── components/
│       └── ConcertCard.tsx     # Reusable card component
├── app/
│   └── router.tsx              # Add /concerts route
└── styles.css                  # Add concert grid styles
```

## Component Design

### 1. Type Definition (`src/features/concerts/types.ts`)

```typescript
export interface Concert {
  id: string;
  title: string;
  artistName: string | null;
  description: string | null;
  venueName: string;
  venueAddress: string | null;
  bannerUrl: string | null;
  startsAt: string; // ISO 8601 date string
  endsAt: string | null;
  minPriceVnd: number | null;
}

export type GetConcertsResponse = Concert[];
```

### 2. API Client (`src/features/concerts/api.ts`)

**Function: `getConcerts()`**

- Calls: `GET /concerts` via `apiFetch<Concert[]>()`
- Returns: `Promise<Concert[]>`
- Error handling: Delegates to `apiFetch` wrapper (throws `ApiError`)
- No caching for MVP (simple `fetch` on each page load)

```typescript
export async function getConcerts(): Promise<Concert[]> {
  return apiFetch<Concert[]>("/concerts");
}
```

### 3. Data Formatting

**Helper: Format Concert Start Date**

```typescript
export const formatConcertDate = (isoString: string): string => {
  const date = new Date(isoString);
  return new Intl.DateTimeFormat("vi-VN", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Ho_Chi_Minh",
  }).format(date);
};
// Example: "2026-06-20T19:30:00Z" → "20 tháng 6, 2026 lúc 19:30"
```

**Helper: Format Price**

```typescript
export const formatPrice = (priceVnd: number | null): string => {
  if (priceVnd === null) return "Đang cập nhật";
  return `Từ ${priceVnd.toLocaleString("vi-VN")} ₫`;
};
// Example: 800000 → "Từ 800.000 ₫"
```

These helpers can live in `src/features/concerts/api.ts` or a separate `utils.ts` file.

### 4. ConcertCard Component

**Props:**

```typescript
interface ConcertCardProps {
  concert: Concert;
  onNavigate: (id: string) => void;
}
```

**Rendering:**

- Banner: `<img src={concert.bannerUrl} />` with CSS fallback class if missing
- Title: `concert.title` (always present)
- Artist: `concert.artistName` (show if not null)
- Venue: `concert.venueName` + `concert.venueAddress` (address optional)
- Date: `formatConcertDate(concert.startsAt)`
- Price: `formatPrice(concert.minPriceVnd)`
- Button: "Xem chi tiết" (or click entire card)
- Click handler: `onClick={() => onNavigate(concert.id)}`

**Styling:**

- Card container: semantic class `.concert-card`
- Image container: class `.concert-card-banner` with aspect ratio `16/9` or `4/3`
- Fallback banner: CSS class `.concert-card-banner--empty` (background color + icon/text)
- Content: semantic classes for title, artist, venue, date, price
- Button: Reuse existing `Button` component or plain `<button>` styled with `.concert-card-action`

### 5. ConcertsListPage Component

**State:**

```typescript
const [concerts, setConcerts] = useState<Concert[]>([]);
const [isLoading, setIsLoading] = useState(true);
const [error, setError] = useState<ApiError | null>(null);
```

**Lifecycle:**

- `useEffect` runs on mount
- Calls `getConcerts()`
- Sets loading state, then data or error
- No refetch on dependencies (fetch once per page visit)

**Handlers:**

```typescript
const handleNavigate = (id: string) => {
  navigate(`/concerts/${id}`);
};

const handleRetry = () => {
  setError(null);
  setIsLoading(true);
  fetchConcerts(); // Call again
};
```

**Render logic:**

| State           | UI                                          |
| --------------- | ------------------------------------------- |
| Loading         | Spinner or 3-4 skeleton cards               |
| Error           | Alert with error message + "Thử lại" button |
| Empty (data=[]) | "Không có concert nào hiện tại."            |
| Success         | Grid of ConcertCard components              |

### 6. Responsive Grid Layout

**CSS Media Queries:**

```css
.concerts-grid {
  display: grid;
  gap: 2rem;
  grid-template-columns: 1fr; /* mobile: 1 col */
}

@media (min-width: 768px) {
  .concerts-grid {
    grid-template-columns: repeat(2, 1fr); /* tablet: 2 cols */
  }
}

@media (min-width: 1024px) {
  .concerts-grid {
    grid-template-columns: repeat(3, 1fr); /* desktop: 3 cols */
  }
}
```

Breakpoints follow common conventions (Tailwind-like):

- Mobile: `< 768px`
- Tablet: `768px - 1023px`
- Desktop: `≥ 1024px`

### 7. Banner Image Fallback

**Approach: CSS-based**

```css
.concert-card-banner {
  aspect-ratio: 16 / 9;
  background-color: var(--surface-soft); /* fallback color from design system */
  background-image: url(concert.bannerUrl);
  background-size: cover;
  background-position: center;
  display: flex;
  align-items: center;
  justify-content: center;
}

.concert-card-banner--empty::after {
  content: "Chưa có hình ảnh";
  color: var(--muted);
  font-size: 0.875rem;
}
```

If `bannerUrl` is null, the `<img>` won't load, and the fallback background color shows through.

Alternatively, use `onError` handler on `<img>` to add a class that swaps to fallback styling.

### 8. Router Integration

**Update `src/app/router.tsx`:**

```typescript
import { ConcertsListPage } from '../features/concerts/pages/ConcertsListPage';

export function AppRouter() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/concerts" replace />} />
      <Route path="/concerts" element={<ConcertsListPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/home" element={<Navigate to="/concerts" replace />} />
      <Route path="*" element={<Navigate to="/concerts" replace />} />
    </Routes>
  );
}
```

Note: `/concerts/:id` is not implemented yet; will return 404 (catch-all redirect).

### 9. Error Handling

**ApiError type** (already defined in `src/lib/api-client.ts`):

```typescript
type ApiError = {
  status: number;
  message: string;
  data?: unknown;
};
```

**In ConcertsListPage:**

- Catch errors from `getConcerts()`
- Display in Alert component (reuse existing `Alert.tsx`)
- Show error message + status code if helpful
- "Thử lại" button calls `handleRetry()`

### 10. Configuration

**No new env vars required** — Use existing:

- `VITE_API_BASE_URL` (defaults to `http://localhost:3000`)

**Assumptions:**

- Backend is running on `http://localhost:3000` (dev)
- Backend `GET /concerts` endpoint is implemented and functional
- CORS is configured to allow requests from `http://localhost:5173`

## Performance & UX Considerations

1. **Loading state**: Show skeleton or spinner instead of blank screen
2. **Error recovery**: Allow user to retry without page reload
3. **Image lazy-loading**: Not in MVP; consider adding if many concerts
4. **No pagination**: MVP shows all concerts; pagination can be added later
5. **No search/filter**: MVP shows full list; advanced filters future task

## Testing Strategy (Not in Scope Yet)

Future tasks may add:

- Unit tests for formatters (`formatConcertDate`, `formatPrice`)
- Mock API responses and test ConcertsListPage loading/error states
- E2E tests for navigation to `/concerts/:id`
