# Customer order history backend

The authenticated frontend Order History page consumes GET /orders/history.

## Contract and protection

- Send the existing access token as Authorization: Bearer <token>.
- Ownership comes only from the verified JWT subject. The endpoint does not accept a user ID.
- The response is a bare OrderHistoryItem array, ordered by createdAt DESC and then id DESC.
- The current frontend has no pagination metadata, so this temporary contract returns at most 100 orders.
- Each tickets entry is an OrderItem summary (ticketTypeName and quantity), not an issued Ticket.
- The read uses PostgreSQL only and does not mutate orders, reservations, inventory, payments, tickets, Redis, or Kafka.
- If a legacy concert has no performanceStartAt, the API falls back to its required startsAt.

## Demo data

Run the backend Prisma seed, then sign in with:

- Email: audience@ticketbox.local
- Password: Audience@123456

The reserved DEMO-HISTORY-* namespace contains one deterministic order for each status: PENDING, PAID, FAILED, EXPIRED, and CANCELLED. These display fixtures contain Order and OrderItem records only. Run node prisma/verify-order-history-seed.js to execute the helper twice and verify stable counts and absence of demo payments/tickets.

## Deferred scope

Cursor pagination, GET /orders/:orderId, payment initiation and callbacks, ticket issuance, QR delivery, refunds, cancellations, and post-payment polling require separate capabilities and are not implemented here.
