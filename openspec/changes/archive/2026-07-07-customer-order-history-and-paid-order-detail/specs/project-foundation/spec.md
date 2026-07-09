## ADDED Requirements

### Requirement: Authenticated shell exposes role-aware Audience order-history navigation
The Web Application shell SHALL expose “Sự kiện” and “Đơn hàng của tôi” for Audience-capable users while preserving Organizer routes and logout behavior.

#### Scenario: Audience sees history navigation
- **GIVEN** an authenticated Audience-capable session
- **WHEN** the shell renders
- **THEN** it MUST provide “Sự kiện”, “Đơn hàng của tôi”, and “Đăng xuất”
- **AND** the active destination MUST be indicated accessibly

#### Scenario: Organizer routing remains unchanged
- **WHEN** history navigation is added
- **THEN** existing Organizer routes, permissions, and post-login redirects MUST remain functional

#### Scenario: Navigation remains responsive
- **WHEN** the shell renders narrowly or is keyboard-operated
- **THEN** navigation MUST avoid horizontal overflow and retain visible focus
