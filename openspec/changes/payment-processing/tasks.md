## 1. Backend: Payments Module Setup

- [x] 1.1 Create the `payments` module structure in the `backend/src/modules`.
- [x] 1.2 Define the `PaymentProvider` interface and `PaymentFactory`.
- [x] 1.3 Create the `payments` entity and repository for the PostgreSQL database.
- [x] 1.4 Create a database migration for the `payments` table.

## 2. Backend: Payment Provider Integration

- [x] 2.1 Implement the `VnpayProvider` class.
- [x] 2.2 Implement the `MomoProvider` class.
- [x] 2.3 Add necessary configuration for VNPAY and MoMo to `app.config.ts`.
- [x] 2.4 Implement the circuit breaker for payment provider calls.

## 3. Backend: API Endpoints

- [x] 3.1 Create the `payments.controller.ts` with an endpoint to create a payment.
- [x] 3.2 Create an endpoint to handle payment webhooks.
- [x] 3.3 Secure the endpoints with appropriate guards.

## 4. Backend: Business Logic

- [x] 4.1 Implement the `payments.service.ts` to handle payment creation and status updates.
- [x] 4.2 Ensure idempotency in payment creation and webhook processing.
- [x] 4.3 Integrate the `payments` module with the `orders` module.

## 5. Frontend: Payment UI

- [x] 5.1 Create a payment selection component in the frontend.
- [x] 5.2 Implement the logic to call the backend to create a payment.
- [x] 5.3 Handle the redirect to the payment provider's page.
- [x] 5.4 Create pages to show payment success and failure to the user.

## 6. Testing

- [x] 6.1 Write unit tests for the `payments` module.
- [x] 6.2 Write end-to-end tests for the payment flow.
