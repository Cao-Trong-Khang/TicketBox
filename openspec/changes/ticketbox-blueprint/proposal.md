## Problem

Large-scale concert ticket sales in Vietnam are currently fragmented across channels such as Zalo OA, Google Forms, manual bank transfers, and ad hoc spreadsheets. This creates unfair queues, bot abuse, website crashes, fraud risk, duplicate or missing tickets, payment uncertainty, and operational gaps at venue check-in.

TicketBox needs a single high-concurrency ticketing platform that supports the full lifecycle from concert publishing through ticket purchase, payment confirmation, e-ticket delivery, organizer administration, guest-list import, notifications, and offline-capable event check-in.

## Goals

- Handle peak ticket-sale traffic of approximately 80,000 visitors within 5 minutes, with 70% arriving in the first minute, without overloading critical backend services.
- Protect sale APIs from bots, aggressive clients, and repeated requests while preserving fair access for legitimate audience users.
- Keep public concert listing and concert detail pages available under read-heavy traffic by serving sufficiently fresh cached data and reducing direct database load.
- Prevent overselling and duplicate final ticket assignment for limited ticket classes such as SVIP, VIP, GA, CAT1, and CAT2.
- Enforce configurable per-user purchase limits per concert and ticket type across all successfully paid orders, including concurrent purchase attempts.
- Integrate VNPAY and MoMo safely with idempotent payment attempts, timeout handling, double-charge prevention, and failure isolation so non-payment browsing remains available during payment gateway outages.
- Deliver QR-code e-tickets after successful payment and notify users through in-app notification and email.
- Send automatic reminders 24 hours before each concert and support adding future notification channels such as Zalo OA or SMS without major redesign.
- Enforce role-based access control so audience users, organizers, and check-in staff can only access capabilities appropriate to their roles.
- Provide organizer capabilities for concert setup, ticket configuration, sale-window management, cancellation or updates, and sales/revenue monitoring.
- Provide check-in staff with a mobile scanning workflow that works under weak or unstable network conditions and synchronizes offline check-ins safely.
- Support asynchronous artist PDF/press-kit processing for AI-generated artist bios, with processing status and fallback behavior when extraction or AI generation fails.
- Import scheduled sponsor VIP guest-list CSV files asynchronously with validation, deduplication, error reporting, and no disruption to live ticketing or check-in workflows.

## Users and Needs

- Audience users need to browse upcoming concerts, inspect artist and venue details, view an interactive SVG seating map by ticket zone, see sufficiently fresh remaining ticket counts, buy tickets fairly within organizer-configured limits, pay through supported payment gateways, receive QR-code e-tickets with in-app and email confirmations, receive concert reminders, and check in at the venue gate.

- Organizer users need controlled admin access to create and manage concerts, configure ticket types, prices, capacities, sale windows, and per-user purchase limits, upload artist PDFs or press kits for AI-generated bios, update or cancel concerts, monitor ticket sales and revenue statistics, and manage operational data such as scheduled VIP guest-list imports.

- Check-in staff need mobile access to scan ticket QR codes, validate regular tickets and VIP guest-list entries quickly, continue check-in work during weak or unavailable network conditions, and synchronize gate activity when connectivity returns.

## Scope

### In Scope

- Build a local Docker Compose-based prototype of TicketBox.
- Provide public concert discovery, concert detail pages, artist and venue information, interactive SVG zone maps by ticket zone, and sufficiently fresh ticket availability display.
- Provide the audience purchase flow, including ticket selection, payment handling, successful payment confirmation, QR-code e-ticket generation, and purchase notifications.
- Provide organizer administration for creating and managing concerts, configuring ticket types, prices, capacities, sale windows, and per-user purchase limits, updating or canceling concerts, uploading artist PDFs or press kits, and viewing sales or revenue statistics.
- Provide authentication and role-based access control for audience users, organizer users, and check-in staff.
- Provide mechanisms for traffic protection, fair purchase handling, concurrency-safe ticket assignment, and enforcement of per-user purchase limits.
- Provide payment integration behavior for VNPAY and MoMo, including payment callbacks, timeouts, retries, and degraded behavior when payment gateways are unavailable.
- Provide notification workflows through in-app notification and email, while allowing future notification channels such as Zalo OA or SMS to be added without changing the core purchase flow.
- Provide a mobile check-in workflow for scanning ticket QR codes, validating VIP guest-list entries, recording scans during weak or unavailable network conditions, and synchronizing gate activity when connectivity returns.
- Provide asynchronous artist PDF or press-kit processing for AI-generated artist bios, including processing status and failure handling.
- Provide scheduled sponsor VIP guest-list CSV import with validation, deduplication, malformed-row handling, error reporting, and no disruption to live ticketing or check-in workflows.

### Out of Scope

- Production cloud deployment, production infrastructure provisioning, and managed cloud services.
- Real payment settlement with live money movement; payment flows are limited to sandbox or simulated gateway environments.
- Full anti-scalping identity verification across multiple accounts, devices, payment instruments, or national identity documents.
- Direct API, webhook, or database integration with sponsor guest-list systems; TicketBox only supports scheduled CSV imports for the course project.
- Real-time individual seat selection or seat-level booking beyond the required zone-based ticket model.

## Risks and Constraints

- Traffic spikes during ticket releases can overload backend APIs. Excessive requests must be limited before expensive business logic is executed.
- Bot-like clients and repeated purchase attempts can reduce fairness for legitimate audience users. Critical sale APIs must include traffic protection and abuse mitigation.
- Ticket contention can cause overselling or duplicate final ticket assignment. Inventory decrement and ticket assignment must be handled with concurrency-safe consistency controls.
- Configurable per-user purchase limits can be bypassed under concurrent requests. Quota checks must be atomic and reconciled against authoritative paid-order records.
- Order, payment, and ticket states can become inconsistent. State transitions must be explicit, idempotent, retry-safe, and recoverable.
- Payment gateways may fail, timeout, or remain unavailable for long periods. Payment handling must be isolated so users can still browse concerts and view ticket information when payment providers are degraded.
- Read-heavy public pages can overload the database. Frequently accessed concert data must be cached, and ticket availability freshness must be managed carefully.
- Admin and check-in features expose sensitive operations. Access control must prevent unauthorized concert changes, ticket validation, and revenue access.
- Offline check-in can lose scan records or admit duplicate entries. The mobile check-in workflow must support local validation, durable offline storage, synchronization, and conflict resolution.
- Sponsor VIP guest-list integration is constrained to scheduled CSV files. TicketBox cannot rely on real-time API validation from the sponsor system.
- CSV guest-list imports can contain malformed rows, duplicates, or late changes. Imports must include validation, deduplication, error reporting, and must not interrupt live ticketing or check-in workflows.
- Notification delivery can fail or be delayed. Ticket issuance and ticket access must not depend solely on successful in-app or email notification delivery.
- AI-generated artist biographies depend on PDF text extraction quality and AI model availability. The workflow must expose processing status and fallback behavior when extraction or generation fails.
