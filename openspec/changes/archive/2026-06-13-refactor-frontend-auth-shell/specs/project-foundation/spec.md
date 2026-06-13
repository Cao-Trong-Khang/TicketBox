## MODIFIED Requirements

### Requirement: Repository provides a frontend application foundation

## Specification: Frontend Application Foundation

## Description

The system SHALL provide `/frontend` as a Vite + React + TypeScript web application foundation for Audience and Organizer users. The foundation MUST be runnable locally and in Docker, MUST keep backend API base URL configuration, and MUST provide a clean three-screen authentication shell before future concert browsing, checkout, and organizer administration features are added.

## Main Flow

1. A developer installs frontend dependencies or runs the frontend container.
2. The Web Application starts through Vite.
3. The Web Application reads its backend API base URL from environment configuration.
4. The Web Application renders a TicketBox shell with routes for `/`, `/login`, and `/register`.
5. A user can open the login screen and submit credentials to the Backend API authentication endpoint.
6. A user can open the register screen and submit registration information to the Backend API authentication endpoint.
7. After successful registration, the Web Application sends the user to the login flow instead of automatically logging the user in.
8. After successful login, the Web Application stores the returned access token for later API calls and sends the user to `/`.

## Failure Scenarios

- If the backend API URL is missing, the frontend MUST use a documented local default.
- If login fails, the frontend MUST show a clear non-destructive error state and remain on the login screen.
- If registration fails, the frontend MUST show a clear non-destructive error state and remain on the register screen.

## Constraints

- The frontend MUST use Vite, React, and TypeScript.
- The frontend source SHOULD be organized into app wiring, shared layout/UI components, feature-level auth code, generic pages, shared API utilities, and tests.
- The frontend MUST expose only `/`, `/login`, and `/register` as user-visible screens for this change.
- The home screen MUST remain empty or minimal and MUST NOT display fake concert, payment, ticket, organizer, or check-in data.
- The frontend MUST NOT implement fake payment settlement, fake ticket issuance, or fake organizer data that appears authoritative.
- The frontend MUST NOT enforce RBAC as the final authorization authority; backend guards remain authoritative.
- The frontend MUST NOT derive role or permission claims from the JWT.

## Acceptance Criteria

#### Scenario: Frontend starts locally
- **WHEN** a developer runs the documented frontend development command
- **THEN** the Vite React TypeScript app MUST start successfully and render the TicketBox web shell

#### Scenario: Frontend uses configured API URL
- **WHEN** the frontend starts with a configured backend API base URL
- **THEN** authentication API calls from the frontend MUST target that configured backend URL

#### Scenario: Login screen is available
- **WHEN** a user opens `/login`
- **THEN** the frontend MUST render a polished login form with email and password inputs

#### Scenario: Register screen is available
- **WHEN** a user opens `/register`
- **THEN** the frontend MUST render a polished registration form with display name, email, password, and password confirmation inputs

#### Scenario: Register succeeds using flow A
- **WHEN** registration succeeds
- **THEN** the frontend MUST show success feedback and navigate the user to `/login`
- **AND** the frontend MUST NOT auto-login the user

#### Scenario: Login succeeds
- **WHEN** login succeeds and the Backend API returns `{ accessToken }`
- **THEN** the frontend MUST store the access token for later API calls
- **AND** the frontend MUST navigate the user to `/`

#### Scenario: Home screen stays empty
- **WHEN** a user opens `/`
- **THEN** the frontend MUST render an empty or minimal home screen without fake TicketBox domain data
