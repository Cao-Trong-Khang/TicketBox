## Context

The organizer frontend currently renders ticket-type cards with status toggle actions in two places: the inline ticket-type section on the edit concert page and the legacy organizer ticket-type management page. Both experiences already load ticket types, support create and edit flows, and rely on the existing backend status endpoints, but the product decision now requires a simpler edit-only UI.

## Goals / Non-Goals

**Goals:**

- Show only the edit action for organizer ticket types in the frontend.
- Keep ticket-type status visible as read-only information.
- Preserve current create/edit validation and create-concert auto-activation behavior.
- Keep the change frontend-only and low risk.

**Non-Goals:**

- Removing backend activate/deactivate endpoints or changing backend behavior.
- Changing public ticket-type visibility or public concert detail behavior.
- Changing payment, notification, QR, or check-in flows.

## Decisions

1. UI-only simplification for organizer ticket-type actions.
   - The frontend will stop rendering Activate and Deactivate buttons in both organizer ticket-type views.
   - Status will remain visible as a read-only badge or label so organizers can still understand whether a ticket type is active.
   - Rationale: this matches the product decision and avoids introducing extra stateful actions in the organizer experience.

2. Preserve existing create/edit form behavior.
   - The current form components, validation rules, and payload handling will remain intact.
   - Rationale: the task is to remove action controls, not change the underlying ticket-type management workflow.

3. Keep backend API helpers available but unused where appropriate.
   - No backend code will be modified, and the frontend will not depend on status toggles for the new UI.
   - Rationale: this keeps the change scoped to the organizer frontend and avoids unnecessary backend churn.

## Risks / Trade-offs

- [Older inactive ticket types may still be loaded and displayed without manual toggle controls] → Mitigation: show the status as read-only information and keep edit actions available.
- [Frontend tests may need updates because button labels change] → Mitigation: update assertions to reflect the new edit-only action model.

## Migration Plan

- No database or backend migration is required.
- Roll out as a frontend-only change and verify the edit page, create flow, and existing tests.

## Open Questions

- None.
