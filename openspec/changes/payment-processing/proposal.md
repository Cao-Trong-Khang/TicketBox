## Why

This change introduces a robust payment processing system to allow users to purchase concert tickets securely and reliably. It is a core component of the ticketing platform, enabling monetization and a seamless user experience.

## What Changes

- Integration with VNPAY and MoMo payment gateways.
- A new set of API endpoints for creating, processing, and verifying payments.
- A database schema to store payment transaction details.
- Idempotent payment processing to prevent duplicate charges.
- A mechanism to handle payment failures and update order statuses accordingly.

## Capabilities

### New Capabilities
- `payment-processing`: Handles all aspects of payment transactions, including integration with external gateways, transaction logging, and status management.

### Modified Capabilities
- `ticket-purchasing`: The ticket purchasing flow will be updated to include the payment step.

## Impact

- **Code**: New module `payments` in the backend. Modifications to the `orders` and `tickets` modules. New components in the frontend for payment selection and processing.
- **APIs**: New `/payments` endpoint.
- **Dependencies**: New dependencies on VNPAY and MoMo SDKs.
- **Systems**: Interacts with external payment gateways (VNPAY, MoMo).
