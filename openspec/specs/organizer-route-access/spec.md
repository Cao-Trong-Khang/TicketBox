# organizer-route-access Specification

## Purpose

Define the frontend organizer-route access behavior so organizer-only views are protected and the Admin Dashboard offers clear navigation to the organizer console.

## Requirements

### Requirement: Organizer routes are protected in the web app

The web application SHALL wrap the organizer routes `/organizer/concerts`, `/organizer/concerts/new`, and `/organizer/concerts/:id/edit` with the existing organizer guard so authenticated users without the `ORGANIZER` role are redirected to `/concerts`.

#### Scenario: Organizer accesses organizer routes

- **WHEN** an authenticated user with the `ORGANIZER` role visits one of the organizer routes
- **THEN** the matching organizer page is rendered

#### Scenario: Non-organizer is redirected

- **WHEN** an authenticated user without the `ORGANIZER` role visits one of the organizer routes
- **THEN** the web app redirects the user to `/concerts`

### Requirement: Admin dashboard offers organizer navigation

The Admin Dashboard SHALL make the "Concert Management" card navigate to `/organizer/concerts` when selected.

#### Scenario: Organizer clicks the card

- **WHEN** an organizer user clicks the "Concert Management" card
- **THEN** the app navigates to `/organizer/concerts`

#### Scenario: Other dashboard cards remain unchanged

- **WHEN** the Admin Dashboard renders
- **THEN** the other dashboard cards continue to behave as before without additional navigation changes
