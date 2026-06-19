## ADDED Requirements

### Requirement: Web Application redirects users after login by role

## Specification: Role-Based Login Routing

## Description

The Web Application SHALL redirect authenticated users after login according to their server-returned roles. This behavior improves UX for Audience, Organizer, and Gate Staff users, while final authorization remains enforced by the Backend API.

## Main Flow

1. A user submits credentials through the Web Application login form.
2. The Web Application calls `POST /auth/login`.
3. The Backend API returns `access_token`, `refresh_token`, and a user profile with `roles[]`.
4. The Web Application stores the authenticated session according to the app's existing auth-state pattern.
5. The Web Application redirects based on roles: `ORGANIZER` to `/admin/dashboard`, `GATE_STAFF` to `/checkin`, otherwise `AUDIENCE` to `/concerts`.

## Failure Scenarios

- If login fails with `401 Unauthorized`, the Web Application MUST keep the user on the login screen and show the server-provided error message.
- If the returned profile has no recognized role, the Web Application MUST route to the safest authenticated Audience area, `/concerts`.

## Constraints

- Frontend role routing MUST be treated as UX only and MUST NOT replace backend authorization.
- If a user has multiple roles, `ORGANIZER` routing MUST take priority over `GATE_STAFF`, and `GATE_STAFF` MUST take priority over `AUDIENCE`.
- The Web Application MUST use server-returned role codes, not locally invented role state.

## Acceptance Criteria

#### Scenario: Audience user redirects to concerts
- **GIVEN** login succeeds with roles `['AUDIENCE']`
- **WHEN** the Web Application handles the login response
- **THEN** it MUST redirect the user to `/concerts`

#### Scenario: Organizer user redirects to dashboard
- **GIVEN** login succeeds with roles including `ORGANIZER`
- **WHEN** the Web Application handles the login response
- **THEN** it MUST redirect the user to `/admin/dashboard`

#### Scenario: Gate Staff user redirects to check-in
- **GIVEN** login succeeds with roles `['GATE_STAFF']`
- **WHEN** the Web Application handles the login response
- **THEN** it MUST redirect the user to `/checkin`

### Requirement: Web Application protects role-specific routes

## Specification: Frontend Route Guards

## Description

The Web Application SHALL guard role-specific routes using authenticated session state so users are guided away from screens they cannot use. The Backend API remains the final authorization authority for all protected data and mutations.

## Main Flow

1. A user navigates to a protected route.
2. The Web Application checks whether an authenticated session exists.
3. For `/admin/*`, the Web Application checks for `ORGANIZER`.
4. For `/checkin/*`, the Web Application checks for `GATE_STAFF`.
5. For `/tickets/my`, the Web Application checks only that the user is authenticated.
6. If the session or required role is missing, the Web Application redirects to an appropriate authenticated or login route.

## Failure Scenarios

- If no session exists, protected routes MUST redirect to login.
- If a session exists but lacks the required role, role-specific routes MUST redirect away from the protected area.
- If the Backend API returns `401` or `403` despite the frontend guard passing, the Web Application MUST respect the backend response and avoid rendering protected data.

## Constraints

- `/admin/*` MUST require `ORGANIZER` in frontend route guards.
- `/checkin/*` MUST require `GATE_STAFF` in frontend route guards.
- `/tickets/my` MUST require authentication and MUST rely on the server to scope tickets by `ticket.owner_user_id = current_user`.
- Frontend guards MUST NOT be treated as final authorization.

## Acceptance Criteria

#### Scenario: Organizer route requires organizer role
- **GIVEN** an authenticated user has only `AUDIENCE`
- **WHEN** the user navigates to `/admin/dashboard`
- **THEN** the Web Application MUST redirect away from the admin route

#### Scenario: Check-in route requires Gate Staff role
- **GIVEN** an authenticated user has only `AUDIENCE`
- **WHEN** the user navigates to `/checkin`
- **THEN** the Web Application MUST redirect away from the check-in route

#### Scenario: My tickets requires authentication
- **GIVEN** no authenticated session exists
- **WHEN** a user navigates to `/tickets/my`
- **THEN** the Web Application MUST redirect to login

### Requirement: Web Application renders role-specific navigation

## Specification: Role-Based Navigation

## Description

The Web Application SHALL render navigation entries that match the authenticated user's roles while relying on Backend API authorization for protected operations.

## Main Flow

1. The Web Application loads the authenticated user profile and `roles[]`.
2. If the user has `ORGANIZER`, the navigation includes Dashboard, Concert Management, Revenue Stats, VIP CSV Import, and AI Artist Bio.
3. If the user has `GATE_STAFF`, the navigation includes QR Scanner, VIP Guest List, and Offline Scan Log.
4. If the user has `AUDIENCE`, the navigation includes My Tickets.
5. Users with multiple roles see the union of role-appropriate navigation entries.

## Failure Scenarios

- If profile loading fails with `401 Unauthorized`, the Web Application MUST clear the session and route to login.
- If a navigation target later returns `403 Forbidden`, the Web Application MUST respect the backend denial.

## Constraints

- Navigation MUST be driven by server-returned role codes.
- Navigation MUST NOT expose `password_hash` or any sensitive token payload details.
- Role-specific navigation MUST NOT imply backend permission if the Backend API denies the operation.

## Acceptance Criteria

#### Scenario: Organizer navigation appears
- **GIVEN** an authenticated user has `ORGANIZER`
- **WHEN** the Web Application renders navigation
- **THEN** it MUST include Dashboard, Concert Management, Revenue Stats, VIP CSV Import, and AI Artist Bio

#### Scenario: Gate Staff navigation appears
- **GIVEN** an authenticated user has `GATE_STAFF`
- **WHEN** the Web Application renders navigation
- **THEN** it MUST include QR Scanner, VIP Guest List, and Offline Scan Log

#### Scenario: Audience navigation appears
- **GIVEN** an authenticated user has `AUDIENCE`
- **WHEN** the Web Application renders navigation
- **THEN** it MUST include My Tickets
