## Why

Large concert venues can have unstable mobile connectivity when tens of thousands of audience members arrive at the same time. Check-in staff need a mobile workflow that can scan QR-code e-tickets, keep admitting valid attendees during network loss, and safely synchronize all scan records once connectivity returns.

## What Changes

- Add an offline-capable gate check-in workflow for Check-in Staff using the native Android mobile app.
- Allow assigned staff devices to preload event ticket and VIP guest-list validation data before or during an event.
- Record each scan in durable local mobile storage when the device is offline or the backend is temporarily unreachable.
- Synchronize pending scan logs to the Backend API when connectivity returns.
- Resolve duplicate and conflicting scans on the backend with PostgreSQL as the authoritative source of check-in state.
- Expose sync outcomes to the mobile app so staff can distinguish accepted, duplicate, invalid, expired, unauthorized, and conflict results.
- Preserve auditability for sensitive check-in actions and conflict resolution.

## Capabilities

### New Capabilities

- `offline-gate-checkin`: Check-in Staff can scan QR-code e-tickets and VIP guest-list entries at venue gates, continue temporary validation during weak or unavailable network conditions, and synchronize durable offline scan logs back to TicketBox.

### Modified Capabilities

- None.

## Impact

- **Roles impacted**: Check-in Staff are the primary users. Audience users are impacted indirectly because their QR-code e-tickets can be validated at the gate. Organizers are impacted indirectly through event operations and check-in reporting, but organizer-facing reporting is not expanded by this change.
- **External systems**: This feature does not call VNPAY/MoMo, Email Provider, AI Model, or Sponsor CSV Files. It depends on ticket and VIP guest data that already exists in TicketBox.
- **Components impacted**: Check-in Mobile App, Backend API, PostgreSQL, Redis rate limiting for sync APIs, and audit logging.
- **Global goals supported**: Supports offline-capable event check-in, role-based access control, QR-code e-ticket validation, VIP guest-list validation, and the constraint that PostgreSQL remains the source of truth for check-in validity.
- **Data impact**: Uses existing `tickets`, `vip_guests`, `check_ins`, `users`, role/permission tables, and audit logs from the global design. Any required additions should stay limited to check-in metadata such as device identifiers, local scan identifiers, sync status, conflict result, and indexes needed for synchronization.
- **Open questions**: None. This feature is already within the global Proposal and Technical Design scope.
