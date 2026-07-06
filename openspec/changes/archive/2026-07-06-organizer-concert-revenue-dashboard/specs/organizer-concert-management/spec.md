## ADDED Requirements

### Requirement: Organizer concert cards include a revenue dashboard action
The system SHALL render a `Doanh thu` action on organizer concert cards in the `Concert của bạn` page so organizers can open the revenue dashboard for an owned concert. Organizer cards SHALL continue to show organizer-only actions and SHALL NOT restore the audience `Xem chi tiết` action.

#### Scenario: Organizer card shows revenue action
- **WHEN** an authenticated organizer views a concert card in the `Concert của bạn` page
- **THEN** the card footer includes `Doanh thu` alongside `Sửa` and `Hủy`

#### Scenario: Revenue action uses organizer route
- **WHEN** an organizer clicks `Doanh thu` on a concert card
- **THEN** the Web Application navigates to the organizer revenue dashboard route for that concert

#### Scenario: Audience detail action remains absent
- **WHEN** an organizer views a concert card in the organizer dashboard
- **THEN** the card does not render the audience `Xem chi tiết` action
