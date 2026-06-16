## Why

Concert attendees currently select ticket quantities and see a summary, but clicking "Tiếp tục đặt vé" (Continue to Order) does nothing. The backend order creation API is complete, but the frontend has no integration to call it. This blocks the core ticketing workflow—users cannot currently create orders from the concert detail page. This change connects the frontend UI to the working backend API, enabling end-to-end order creation.

## What Changes

- **ConcertDetailPage**: Replace the "Tiếp tục đặt vé" button handler with actual POST /orders API call
- **TicketSelectionSummary**: Add submission loading state to disable button during API request
- **New orders feature module**: Create `src/features/orders/` with API client, types, and OrderPendingPage
- **Router**: Add `/orders/:orderId` route to display pending order details (order code, status, total, expiry)
- **Error handling**: Show user-friendly messages for authentication (401), validation (400), inventory (409) errors
- **Idempotency**: Generate UUID on client for idempotency key to prevent duplicate orders on retry

## Capabilities

### New Capabilities

- `create-order-flow`: Frontend integration for creating orders from concert detail page, including API client, error handling, idempotency, pending order display page, and 401/400/409 error messages.

### Modified Capabilities

- (none - no requirement changes to existing capabilities)

## Impact

- **Frontend code**: `src/features/concerts/pages/ConcertDetailPage.tsx`, `src/features/concerts/components/TicketSelectionSummary.tsx`, new `src/features/orders/`
- **Router**: Add `/orders/:orderId` route
- **APIs called**: POST /orders (authenticated, already implemented in backend)
- **User roles affected**: Audience members purchasing tickets
- **External systems**: None
- **Scope boundaries**: Payment, ticket issuance, order history, and GET /orders/:id lookup are out of scope for this change
