## Why

Organizer users currently manage concerts from a stacked organizer-specific list that does not visually match the buyer-facing concert browsing experience. TicketBox now needs the organizer dashboard to present owned concerts as banner-led cards that feel consistent with the audience area while preserving existing organizer edit and cancel workflows.

## What Changes

- Update the organizer concert dashboard to render owned concerts as card-based items that closely match the audience-facing concert card layout.
- Extend the organizer concert list response so each item includes `bannerUrl` and `venueAddress`, allowing the organizer dashboard to render the real concert banner and fuller venue/location metadata.
- Add an organizer-specific card footer that shows only `Sửa` and `Hủy`, and explicitly does not render the audience `Xem chi tiết` action.
- Add a lifecycle/status badge on organizer cards to distinguish `Sắp diễn ra`, `Đang diễn ra`, `Đã kết thúc`, and `Đã hủy` states without changing existing cancel business rules.

## Capabilities

### New Capabilities
- None.

### Modified Capabilities
- `organizer-concert-management`: update organizer concert list requirements so owned concert list items include `bannerUrl` and `venueAddress`, and define the organizer dashboard card presentation and actions for owned concerts.

## Impact

- Affected users: Organizer users directly; Audience users indirectly because the organizer card must stay visually aligned with the existing audience concert card without regressing audience behavior.
- Affected code: organizer concert list backend DTO/service mapping, organizer dashboard frontend types/API/page, organizer card component, and shared frontend styling.
- APIs: `GET /organizer/concerts` response shape expands to include `bannerUrl` and `venueAddress`.
- External systems: no new external integrations; existing banner URLs continue to use the current backend-served banner upload flow.
- Constraints supported: keeps organizer management within the existing RBAC and ownership model, preserves existing edit/cancel behavior, and stays within the TicketBox scope of organizer concert administration.
