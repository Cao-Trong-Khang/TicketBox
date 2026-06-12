## ADDED Requirements

### Requirement: Frontend supports user registration

## Specification: Frontend User Registration
## Description
The frontend SHALL provide a `/register` page where users can sign up. This targets Audience registration for the MVP.
## Main Flow
1. User navigates to `/register`.
2. User fills out displayName, email, password, and confirmPassword.
3. The frontend performs basic validation (non-empty, matching passwords, min 8 chars).
4. The API client calls `POST /auth/register` with the form data.
5. On success, the UI displays a success message and redirects the user to `/login`.
## Failure Scenarios
- If the backend returns `409 Conflict`, the UI MUST display "Email đã tồn tại".
- If the backend returns `400 Bad Request`, the UI MUST display the validation error message.
- If the API call fails for other reasons, the UI MUST display the generic backend error message.
## Constraints
- Form validation MUST ensure displayName and email are not empty.
- Form validation MUST ensure password is at least 8 characters.
- Form validation MUST ensure confirmPassword matches password.
- API client MUST use `VITE_API_BASE_URL` (fallback to `http://localhost:3000`).
## Acceptance Criteria

#### Scenario: Successful registration
- **WHEN** user submits valid registration data
- **THEN** the system calls the backend and redirects to `/login` on success

#### Scenario: Validation failure display
- **WHEN** user submits an already registered email
- **THEN** the system displays "Email đã tồn tại"

### Requirement: Frontend supports user login

## Specification: Frontend User Login
## Description
The frontend SHALL provide a `/login` page allowing registered users to authenticate.
## Main Flow
1. User navigates to `/login`.
2. User fills out email and password.
3. The API client calls `POST /auth/login` with the credentials.
4. On success, the frontend saves the `accessToken` to `localStorage`.
5. The user is redirected to `/profile`.
## Failure Scenarios
- If the backend returns `401 Unauthorized`, the UI MUST display "Email hoặc mật khẩu không đúng".
- If the API call fails for other reasons, the UI MUST display the backend error message.
## Constraints
- The `accessToken` MUST be stored in `localStorage` upon successful login.
## Acceptance Criteria

#### Scenario: Successful login
- **WHEN** user submits valid credentials
- **THEN** the access token is stored and the user is redirected to `/profile`

#### Scenario: Invalid login
- **WHEN** user submits invalid credentials
- **THEN** the system displays "Email hoặc mật khẩu không đúng"

### Requirement: Frontend supports user profile viewing and logout

## Specification: Frontend User Profile
## Description
The frontend SHALL provide a `/profile` page that fetches and displays the current user's information and allows them to log out.
## Main Flow
1. User navigates to `/profile`.
2. The page calls `GET /auth/me` on load via the API client.
3. The API client automatically attaches the `Authorization: Bearer <accessToken>` header.
4. The UI displays the user's `id` and `email`.
5. The UI provides a "Logout" button.
6. When the user clicks "Logout", the token is removed from `localStorage` and the user is redirected to `/login`.
## Failure Scenarios
- If the `GET /auth/me` call returns `401 Unauthorized` (e.g., token expired or missing), the UI MUST redirect the user to `/login`.
## Constraints
- The API client MUST automatically attach the token from `localStorage` to all authenticated requests.
## Acceptance Criteria

#### Scenario: Viewing profile
- **WHEN** an authenticated user visits `/profile`
- **THEN** the system fetches their data and displays their `email` and `id`

#### Scenario: Unauthorized profile access
- **WHEN** an unauthenticated user visits `/profile`
- **THEN** the system redirects them to `/login`

#### Scenario: Logout
- **WHEN** the user clicks Logout
- **THEN** the token is removed from `localStorage` and the user is redirected to `/login`
