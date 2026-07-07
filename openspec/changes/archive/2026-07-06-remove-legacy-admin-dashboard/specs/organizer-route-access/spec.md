# organizer-route-access Specification

## ADDED Requirements

### Requirement: Organizer sign-in redirects to the organizer console

After a successful sign-in, an authenticated user with the `ORGANIZER` role SHALL be redirected to `/organizer/concerts` instead of the legacy admin dashboard route.

#### Scenario: Organizer user signs in successfully

- **WHEN** an organizer user completes authentication successfully
- **THEN** the web app redirects the user to `/organizer/concerts`

#### Scenario: Organizer routes remain protected

- **WHEN** an authenticated user with the `ORGANIZER` role visits the organizer console routes
- **THEN** the matching organizer page is rendered according to the existing organizer guard

### Requirement: Legacy admin dashboard route is removed from the web app

The legacy `/admin/dashboard` route SHALL no longer be available in the frontend router, and navigating to that path SHALL no longer render the old admin dashboard screen.

#### Scenario: User visits the legacy dashboard route

- **WHEN** a user navigates directly to `/admin/dashboard`
- **THEN** the app no longer serves the legacy dashboard experience

#### Scenario: Existing organizer routes remain available

- **WHEN** an organizer user visits `/organizer/concerts` or related organizer management routes
- **THEN** the organizer console continues to load without regression
