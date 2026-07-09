## Context

The current system lacks a payment processing mechanism, which is essential for the ticket purchasing workflow. This document outlines the technical design for integrating payment gateways and managing payment transactions within the TicketBox platform, as specified in the `payment-processing` proposal.

## Goals / Non-Goals

**Goals:**

- Integrate VNPAY and MoMo as payment providers.
- Implement a new `payments` module in the NestJS backend.
- Define a database schema for storing payment information.
- Ensure payment processing is idempotent to prevent duplicate transactions.
- Handle payment gateway webhooks to update payment statuses asynchronously.
- Implement a circuit breaker for payment gateway interactions to enhance resilience.

**Non-Goals:**

- Implementation of a refund mechanism.
- Support for recurring payments or subscriptions.
- Integration with payment gateways other than VNPAY and MoMo.
- Real payment settlement.

## Decisions

1. **Payment Module and Provider Abstraction**:
    - A new `payments` module will be created in the backend.
    - A `PaymentProvider` interface will be defined to abstract the specific implementations of different payment gateways.
    - Concrete classes `VnpayProvider` and `MomoProvider` will implement this interface.
    - A `PaymentFactory` will be used to select the appropriate provider based on user choice.

2. **Database Schema**:
    - A new `payments` table will be created in the PostgreSQL database with the following columns:
        - `id`: UUID, Primary Key
        - `orderId`: UUID, Foreign Key to `orders` table
        - `provider`: VARCHAR (e.g., 'vnpay', 'momo')
        - `transactionId`: VARCHAR, from the payment provider
        - `amount`: NUMERIC
        - `status`: VARCHAR (e.g., 'pending', 'completed', 'failed')
        - `createdAt`: TIMESTAMP
        - `updatedAt`: TIMESTAMP

3. **Payment Flow**:
    1. The user initiates the payment from the frontend after creating an order.
    2. The backend creates a new payment record with a 'pending' status.
    3. The backend calls the selected payment provider's API to get a payment URL.
    4. The frontend redirects the user to the payment provider's page.
    5. The payment provider sends a webhook to a dedicated endpoint in our backend to notify about the payment status.
    6. The backend verifies the webhook, updates the payment and order status, and if successful, issues the tickets.

4. **Idempotency**:
    - The combination of `orderId` and `provider` will be unique to prevent creating multiple payment attempts for the same order with the same provider.
    - Webhook handlers will check the payment status before processing to avoid duplicate updates.

5. **Circuit Breaker**:
    - The `shared/circuit-breaker` module will be used to wrap calls to external payment gateways.
    - This will prevent cascading failures if a payment provider is down.

## Risks / Trade-offs

- **[Risk]** Payment gateway downtime. → **Mitigation**: The circuit breaker will prevent the system from repeatedly calling a failing service. The user will be notified that the payment service is temporarily unavailable.
- **[Risk]** Webhook delivery failure. → **Mitigation**: Implement a background job that periodically checks the status of pending payments with the payment provider.
- **[Trade-off]** The initial implementation will not have a reconciliation process. This will be added in a future iteration.
