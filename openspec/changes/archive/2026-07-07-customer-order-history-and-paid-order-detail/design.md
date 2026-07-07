## Context

The current frontend has an orders feature containing `OrderPendingPage`, but no order-history list. The backend exposes only `POST /orders`; therefore this change cannot deliver real history data or change persistent order detail without expanding into backend scope and contradicting `create-order-flow`.

This design intentionally builds only the React UI boundary. Frontend tests may mock the boundary. Production code must not invent authoritative orders.

## Goals / Non-Goals

**Goals:**

- Build a polished responsive `/orders` history UI consistent with TicketBox.
- Define frontend view models and a replaceable data-source interface.
- Render localized order summaries and all known status labels.
- Cover loading, empty, unavailable, retry, and image-fallback states.
- Add accessible role-aware navigation.

**Non-Goals:**

- Backend endpoints, Prisma queries, migrations, ownership enforcement, or pagination implementation.
- Refactoring `/orders/:orderId` or changing `OrderPendingPage` behavior.
- Payment initiation, callbacks, provider return URLs, polling, or status mutation.
- Ticket issuance, QR generation/delivery, printing, downloading, or notifications.
- Runtime mock orders or localStorage-backed history.

## Decisions

### Frontend data-source boundary

Create an `OrderHistoryDataSource`/API function returning a frontend contract such as:

```ts
type OrderHistoryStatus = 'PENDING' | 'PAID' | 'FAILED' | 'EXPIRED' | 'CANCELLED';

type OrderHistoryItem = {
  orderId: string;
  orderCode: string;
  status: OrderHistoryStatus;
  totalAmountVnd: number;
  createdAt: string;
  paidAt?: string | null;
  concert: {
    id: string;
    title: string;
    bannerUrl?: string | null;
    performanceStartAt: string;
    venueName: string;
  };
  totalTicketQuantity: number;
  ticketTypeSummary: Array<{ name: string; quantity: number }>;
};
```

The default production adapter may call a documented future endpoint, but the UI must treat 404/501/network failure as “history service unavailable”. Tests inject mocked responses. No production fallback fabricates orders.

### List-only route

Add `/orders` for the history list. Do not change `/orders/:orderId`; its current navigation-state behavior remains governed by `create-order-flow`. History cards may render a detail action only when a supported detail destination is explicitly supplied; otherwise the list must not promise unavailable persistent detail.

### Presentation

Reuse `AppShell`, `Button`, `Alert`, `resolveAssetUrl`, Lucide icons, CSS variables, surfaces, and breakpoints. Use Vietnamese labels, `vi-VN` VND formatting, and `Asia/Ho_Chi_Minh` dates. Status text is visible and not color-only.

### Dependency handling

Loading, empty, successful, and unavailable states are separate. Empty means a successful response with no orders; unavailable means the dependency failed or is not implemented. This avoids disguising a missing backend as a legitimate empty history.

### Deferred paid behavior

PAID is only a visual status/card variant. No provider, ticket, QR, issuance-processing, or polling behavior is included until separate payment and ticket capabilities exist.

## Risks / Trade-offs

- **No backend history endpoint** → UI can be built/tested now, but real runtime data remains unavailable until a separate backend change.
- **List cards cannot guarantee persistent detail** → keep `/orders/:orderId` unchanged and omit/disable unsupported detail navigation.
- **Mocks may drift from the future contract** → keep the view model minimal and document the dependency explicitly.
- **Status data may be incomplete** → render optional fields defensively without inventing values.

## Migration Plan

No database or backend migration. Deploy frontend UI independently; connect the adapter when the backend capability is specified and implemented.

## Open Questions

- What exact future endpoint and pagination contract will supply order history?
- Should the history navigation remain visible while the backend dependency is unavailable, or be feature-flagged until integration?
