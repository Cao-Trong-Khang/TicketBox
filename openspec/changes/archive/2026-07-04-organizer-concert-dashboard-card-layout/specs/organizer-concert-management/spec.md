## ADDED Requirements

### Requirement: Organizer dashboard displays owned concerts as audience-aligned cards
The system SHALL render the organizer `Concert của bạn` page as a responsive card grid whose cards closely match the audience-facing concert card layout while preserving organizer-only controls. Each organizer card SHALL render the concert banner image when `bannerUrl` exists, SHALL render the concert title, artist, performance date/time, and venue/location metadata, and SHALL replace the audience footer action with only `Sửa` and `Hủy`. The organizer card SHALL NOT render `Xem chi tiết`.

#### Scenario: Organizer views owned concerts as cards
- **WHEN** an authenticated organizer opens the `Concert của bạn` page and owned concerts are available
- **THEN** the Web Application renders each owned concert as a card with banner, title, artist, performance date/time, venue/location, lifecycle/status badge, and footer actions `Sửa` and `Hủy`

#### Scenario: Organizer card does not show audience detail action
- **WHEN** an authenticated organizer views a concert card on the `Concert của bạn` page
- **THEN** the card footer does not render the audience `Xem chi tiết` action

#### Scenario: Organizer card falls back only when no banner exists
- **WHEN** an organizer views a concert card for a concert whose `bannerUrl` is null or the image cannot be loaded
- **THEN** the Web Application renders the existing empty-banner fallback for that card instead of a fabricated banner image

## MODIFIED Requirements

### Requirement: Organizer may list only owned concerts

The system SHALL return only concerts where `concert.organizerId === request.user.id` for `GET /organizer/concerts`, sorted by `createdAt DESC`, and each returned concert item SHALL include the display metadata needed by the organizer dashboard card, including `title`, `artistName`, `venueName`, `venueAddress`, `bannerUrl`, `status`, `lifecycleStatus`, `startsAt`, `endsAt`, `performanceStartAt`, `createdAt`, and `updatedAt`.

#### Scenario: List returns owned concerts

- **WHEN** an organizer requests `GET /organizer/concerts`
- **THEN** the response contains only concerts owned by that organizer and is ordered by `createdAt DESC`

#### Scenario: List excludes other organizers concerts

- **WHEN** an organizer requests `GET /organizer/concerts`
- **THEN** concerts owned by other organizers are not included in the response

#### Scenario: List includes organizer card display fields

- **WHEN** an organizer requests `GET /organizer/concerts`
- **THEN** each returned concert item includes `bannerUrl` and `venueAddress` alongside the existing organizer list fields so the organizer dashboard can render banner-led concert cards

### Requirement: Organizer concert response includes bannerUrl field

The system SHALL include `bannerUrl` (nullable string) in all organizer concert responses: list, detail, create, update, and publish, and SHALL include `venueAddress` in organizer list and detail responses so organizer dashboards and editor flows can render full venue/location information consistently.

#### Scenario: Organizer concert detail includes bannerUrl

- **WHEN** an organizer retrieves `GET /organizer/concerts/:id`
- **THEN** the response includes field `bannerUrl: "/uploads/banners/{uuid}.jpg"` or `bannerUrl: null`

#### Scenario: Organizer concert list includes bannerUrl for each concert

- **WHEN** an organizer retrieves `GET /organizer/concerts`
- **THEN** each concert in the list includes `bannerUrl` field

#### Scenario: Organizer concert list includes venueAddress for each concert

- **WHEN** an organizer retrieves `GET /organizer/concerts`
- **THEN** each concert in the list includes `venueAddress` field so organizer cards can render fuller location metadata
