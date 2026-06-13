## 1. Frontend Source Structure

- [x] 1.1 Create app-level routing and shell files under `frontend/src/app`.
- [x] 1.2 Create shared layout components for the app shell and auth screens.
- [x] 1.3 Create shared UI components for buttons, form fields, and feedback alerts.
- [x] 1.4 Move auth pages and auth API/types into `frontend/src/features/auth`.
- [x] 1.5 Move shared API base URL and fetch handling into `frontend/src/lib` utilities.

## 2. Screens and Routing

- [x] 2.1 Keep only `/`, `/login`, and `/register` as user-visible routes.
- [x] 2.2 Replace the current home content with an empty or minimal `HomePage`.
- [x] 2.3 Remove the current `/profile` route from the frontend shell scope.
- [x] 2.4 Update login success behavior to store `accessToken` and navigate to `/`.
- [x] 2.5 Update register success behavior to show success feedback and navigate to `/login`, without auto-login.

## 3. UI Polish

- [x] 3.1 Redesign login and register screens with shared responsive auth layout.
- [x] 3.2 Replace large inline style objects with CSS classes in `styles.css` or component-local class usage.
- [x] 3.3 Add clear loading, error, success, and focus states for auth forms.
- [x] 3.4 Use consistent Vietnamese copy across auth screens.

## 4. Tests and Verification

- [x] 4.1 Update frontend tests for the new router structure.
- [x] 4.2 Add or update tests proving `/login`, `/register`, and `/` render correctly.
- [x] 4.3 Add or update tests proving successful register routes to login and does not store an access token.
- [x] 4.4 Add or update tests proving successful login stores `accessToken` and routes home.
- [x] 4.5 Run frontend test/build commands and verify the implementation works locally.
