## 1. UI cleanup

- [ ] 1.1 Update the edit concert page ticket-type cards to show only the edit action `Sửa`.
- [ ] 1.2 Do not show `Activate`, `Deactivate`, `Kích hoạt`, or `Hủy kích hoạt` in the edit concert page ticket-type cards.
- [ ] 1.3 Keep ticket type status visible as read-only text/badge.
- [ ] 1.4 Update the legacy organizer ticket-type management page to remove `Activate`, `Deactivate`, `Kích hoạt`, and `Hủy kích hoạt` actions.
- [ ] 1.5 Keep status read-only in the legacy ticket-type management page.
- [ ] 1.6 Remove now-unused status-toggle state, handlers, imports, props, or tests where appropriate.
- [ ] 1.7 Do not change backend activate/deactivate endpoints.

## 2. Behavior preservation

- [ ] 2.1 Confirm ticket-type create flow still works with the existing validation rules.
- [ ] 2.2 Confirm ticket-type edit flow still works with the existing validation rules.
- [ ] 2.3 Confirm concert creation with ticket setup still preserves the current auto-activation behavior for newly created ticket types.
- [ ] 2.4 Confirm public concert detail behavior remains unchanged and continues to show active ticket types.
- [ ] 2.5 Do not change payment, notification, QR, or check-in behavior.

## 3. Testing and verification

- [ ] 3.1 Update frontend tests to assert that only the edit action `Sửa` is visible for ticket types.
- [ ] 3.2 Update tests to assert `Activate`, `Deactivate`, `Kích hoạt`, and `Hủy kích hoạt` are not visible where appropriate.
- [ ] 3.3 Run frontend build, lint, and tests if available.
- [ ] 3.4 Resolve any TypeScript, lint, or test regressions.
- [ ] 3.5 Manually verify the edit concert page loads ticket types.
- [ ] 3.6 Manually verify each ticket type shows `Sửa`.
- [ ] 3.7 Manually verify ticket type status is still displayed read-only.
- [ ] 3.8 Manually verify creating a ticket type still works.
- [ ] 3.9 Manually verify editing a ticket type still works.
- [ ] 3.10 Manually verify create concert with ticket setup still auto-activates ticket types.
- [ ] 3.11 Verify no backend files are changed.
- [ ] 3.12 Verify no payment, notification, QR, or check-in files are changed.
