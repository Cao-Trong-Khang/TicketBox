## 1. Backend: Payments Module Setup

- [x] 1.1 Create the `payments` module structure in the `backend/src/modules`.
- [x] 1.2 Define the `PaymentProvider` interface and `PaymentFactory`.
- [x] 1.3 Create the `payments` entity and repository for the PostgreSQL database.
- [x] 1.4 Create a database migration for the `payments` table.

## 2. Backend: Payment Provider Integration

- [ ] 2.1 Implement the `VnpayProvider` class.
- [ ] 2.2 Implement the `MomoProvider` class.
- [ ] 2.3 Add necessary configuration for VNPAY and MoMo to `app.config.ts`.
- [ ] 2.4 Implement the circuit breaker for payment provider calls.

## 3. Backend: API Endpoints

- [ ] 3.1 Create the `payments.controller.ts` with an endpoint to create a payment.
- [ ] 3.2 Create an endpoint to handle payment webhooks.
- [ ] 3.3 Secure the endpoints with appropriate guards.

## 4. Backend: Business Logic

- [ ] 4.1 Implement the `payments.service.ts` to handle payment creation and status updates.
- [ ] 4.2 Ensure idempotency in payment creation and webhook processing.
- [ ] 4.3 Integrate the `payments` module with the `orders` module.

## 5. Frontend: Payment UI

- [ ] 5.1 Create a payment selection component in the frontend.
- [ ] 5.2 Implement the logic to call the backend to create a payment.
- [ ] 5.3 Handle the redirect to the payment provider's page.
- [ ] 5.4 Create pages to show payment success and failure to the user.

## 6. Testing

- [ ] 6.1 Write unit tests for the `payments` module.
- [ ] 6.2 Write end-to-end tests for the payment flow.
