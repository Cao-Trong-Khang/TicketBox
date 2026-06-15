# Design: Frontend — Concert Detail Page

## Architecture Overview

The concert detail page extends the existing concerts feature module with new API functions, types, and a detail page component.

```
src/features/concerts/
├── api.ts
│   ├── getConcerts()                  [existing]
│   ├── getConcertDetail(id)           [NEW]
│   ├── getConcertTicketTypes(id)      [NEW]
│   └── formatters (reuse)
├── types.ts
│   ├── Concert                        [existing]
│   ├── ConcertDetail                  [NEW]
│   ├── TicketType                     [NEW]
│   └── GetConcertsResponse            [existing]
├── pages/
│   ├── ConcertsListPage               [existing]
│   └── ConcertDetailPage              [NEW]
└── components/
    ├── ConcertCard                    [existing]
    └── TicketTypeCard                 [NEW]
```

## Type Definitions

**File:** `src/features/concerts/types.ts`

```typescript
// Mirror backend DTOs exactly

export type ConcertDetail = {
  id: string;
  title: string;
  artistName: string | null;
  description: string | null;
  venueName: string;
  venueAddress: string | null;
  bannerUrl: string | null;
  seatingSvg: string | null; // SVG markup (backend-generated)
  startsAt: string; // ISO 8601
  endsAt: string | null;
};

export type TicketType = {
  id: string;
  code: string;
  name: string;
  priceVnd: number;
  totalQuantity: number;
  availableQuantity: number;
  perUserLimit: number;
  saleStartAt: string; // ISO 8601
  saleEndAt: string | null;
};
```

## API Client Functions

**File:** `src/features/concerts/api.ts` (add to existing)

```typescript
export function getConcertDetail(id: string): Promise<ConcertDetail> {
  return apiFetch<ConcertDetail>(`/concerts/${id}`);
}

export function getConcertTicketTypes(id: string): Promise<TicketType[]> {
  return apiFetch<TicketType[]>(`/concerts/${id}/ticket-types`);
}

// Reuse existing formatters:
// - formatConcertDate(isoString): formats date as vi-VN, Asia/Ho_Chi_Minh
// - formatPrice(priceVnd): formats as "Từ X.XXX ₫"
```

## Page Component Structure

**File:** `src/features/concerts/pages/ConcertDetailPage.tsx`

### State Management

```typescript
const [concertDetail, setConcertDetail] = useState<ConcertDetail | null>(null);
const [ticketTypes, setTicketTypes] = useState<TicketType[]>([]);
const [isLoading, setIsLoading] = useState(true);
const [error, setError] = useState<ApiError | null>(null);
const [notFound, setNotFound] = useState(false);
```

### Data Fetching

- Get ID from route params: `useParams<{ id: string }>()`
- `useEffect` runs once on mount
- Fetch both APIs in parallel: `Promise.all([getConcertDetail(id), getConcertTicketTypes(id)])`
- Error handling:
  - Status 404 (from either endpoint) → `setNotFound(true)`
  - Other errors → `setError(err)`
- Cleanup flag to prevent race conditions (similar to existing list page pattern)

### Render States

| State     | Display                                   |
| --------- | ----------------------------------------- |
| Loading   | "Đang tải thông tin sự kiện..."           |
| Not Found | "Sự kiện không tồn tại"                   |
| Error     | `<Alert tone="error">` + "Thử lại" button |
| Success   | Full concert detail + ticket types        |

## Component Layout

### 1. Banner Section

- Image: `concert.bannerUrl` with fallback to empty state (reuse `ConcertCard` image logic)
- Shows error state icon if image fails to load

### 2. Concert Header

- Title: `concertDetail.title`
- Artist: `concertDetail.artistName` (if present)
- Venue: `concertDetail.venueName` + `concertDetail.venueAddress` (optional)
- Date: `formatConcertDate(concertDetail.startsAt)`

### 3. Description Section

- Text block: `concertDetail.description`
- Only render if description exists

### 4. Seating Map Section

```typescript
{concertDetail?.seatingSvg ? (
  <div className="concert-seatmap">
    {/*
      ⚠️ SVG SAFETY WARNING:
      dangerouslySetInnerHTML is used because the SVG is generated and controlled
      by the backend (ConcertsService.findPublishedConcertDetail).

      If this ever becomes user-uploaded content, MUST add sanitization:
      - Install and use DOMPurify: npm install dompurify
      - Replace with: sanitize(concertDetail.seatingSvg, { ALLOWED_TAGS: ['svg', ...] })

      Current threat model: Backend-controlled = safe. Future user uploads = NOT safe.
    */}
    <div
      dangerouslySetInnerHTML={{
        __html: concertDetail.seatingSvg,
      }}
    />
  </div>
) : (
  <div className="concert-seatmap-placeholder">
    <p>Chưa có sơ đồ chỗ ngồi</p>
  </div>
)}
```

### 5. Ticket Types Section

**Header:** "HẠNG VÉ HIỆN CÓ" or similar

**Empty state:** If `ticketTypes.length === 0`

```
<p>Chưa có hạng vé đang mở bán.</p>
```

**Ticket list:** For each `TicketType`, render `<TicketTypeCard>`

## TicketTypeCard Component

**File:** `src/features/concerts/components/TicketTypeCard.tsx`

**Props:**

```typescript
type TicketTypeCardProps = {
  ticketType: TicketType;
};
```

**Render:**

- **Header:** `ticketType.name` (e.g., "Vé thường") + `(${ticketType.code})` (e.g., "(STANDARD)")
- **Price:** `formatPrice(ticketType.priceVnd)`
- **Availability:**
  - If `ticketType.availableQuantity > 0`:
    - Show "Còn {availableQuantity} vé"
  - If `availableQuantity === 0`:
    - Show "🚫 Hết vé" badge/status text
    - Later: disable button
- **Per-user limit:** "Max {perUserLimit} vé/người"
- **Sale period:**
  - `formatConcertDate(saleStartAt)` + " — " +
  - (if `saleEndAt` exists) `formatConcertDate(saleEndAt)` else "Không giới hạn"
- **Button:** "Chọn vé"
  - **Disabled** (display-only for MVP)
  - Visual indicator that it's disabled (greyed out, cursor: not-allowed)
  - No click handler

**Styling:**

- Vertical card/row layout (not grid)
- Flex container, padding, border, subtle shadow
- Clear separation between card title, details, and button
- If sold out: slight opacity reduction, "Hết vé" text overlay or badge

## Router Integration

**File:** `src/app/router.tsx` (update)

Add route after `/concerts`:

```typescript
<Route path="/concerts/:id" element={<ConcertDetailPage />} />
```

## Formatting & Conventions

**Date formatting** (reuse existing function):

```typescript
formatConcertDate(isoString: string): string
  // Returns: "20 tháng 6, 2026 lúc 19:30"
  // Locale: vi-VN
  // Timezone: Asia/Ho_Chi_Minh
```

**Price formatting** (reuse existing function):

```typescript
formatPrice(priceVnd: number | null): string
  // Returns: "Từ 500.000 ₫" or "Đang cập nhật"
```

**UI Components** (reuse from existing):

- `Alert` (props: `children: string`, `tone: 'error' | 'success'`)
- `Button` (standard HTML button with class names)

## Error Scenarios

### 404 Handling

```
If getConcertDetail or getConcertTicketTypes returns 404:
  → setNotFound(true)
  → Render: "Sự kiện không tồn tại"
  → No retry button (concert genuinely doesn't exist)
```

### Network/Server Error

```
If either API call fails with non-404 status:
  → setError(err)
  → Render: Alert + "Thử lại" button
  → Retry handler re-fetches both APIs
```

### Race Conditions

```
Similar to ConcertsListPage:
  - useEffect sets cleanup flag
  - Responses checked against flag before setState
  - Prevents stale updates if component unmounts
```

## Performance Considerations

- **No lazy loading yet:** All ticket types loaded together (simple, no pagination)
- **No caching yet:** Fresh fetch each page load (safe for MVP)
- **Parallel fetching:** Both APIs requested concurrently, not sequential
- **Image optimization:** Reuse ConcertCard's image error handling

## Accessibility

- Semantic HTML: `<article>`, `<section>`, `<button>`
- ARIA labels for images and empty states
- Button state indicated visually (disabled state)
- Error alerts use `role="alert"`
