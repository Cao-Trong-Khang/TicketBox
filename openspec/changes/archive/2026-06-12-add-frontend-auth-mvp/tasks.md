## 1. Project Setup and Routing

- [x] 1.1 Install `react-router-dom` in the `frontend` directory.
- [x] 1.2 Configure `BrowserRouter` in `src/main.tsx` or `src/App.tsx`.
- [x] 1.3 Create placeholder components for `RegisterPage`, `LoginPage`, and `ProfilePage`.

## 2. API Client and Utilities

- [x] 2.1 Create `src/lib/api.ts` with a base `fetch` wrapper.
- [x] 2.2 Configure the wrapper to read `VITE_API_BASE_URL` (fallback to `http://localhost:3000`).
- [x] 2.3 Implement automatic attachment of `Authorization: Bearer <accessToken>` from `localStorage`.
- [x] 2.4 Implement standardized error parsing to extract `status` and `message` from the backend response.

## 3. Registration Page

- [x] 3.1 Implement the `/register` UI form with `displayName`, `email`, `password`, and `confirmPassword` inputs.
- [x] 3.2 Add client-side validation logic (non-empty, matching passwords, min 8 chars).
- [x] 3.3 Wire the form to call `POST /auth/register` via the API client.
- [x] 3.4 Handle success by redirecting to `/login` and display "Email đã tồn tại" for 409 errors.

## 4. Login Page

- [x] 4.1 Implement the `/login` UI form with `email` and `password` inputs.
- [x] 4.2 Wire the form to call `POST /auth/login` via the API client.
- [x] 4.3 Handle success by storing the returned `accessToken` in `localStorage` and redirecting to `/profile`.
- [x] 4.4 Handle 401 errors by displaying "Email hoặc mật khẩu không đúng".

## 5. Profile Page

- [x] 5.1 Implement the `/profile` UI.
- [x] 5.2 Use `useEffect` to call `GET /auth/me` on component mount.
- [x] 5.3 Implement redirection to `/login` if `GET /auth/me` fails with 401.
- [x] 5.4 Display the fetched user `id` and `email`.
- [x] 5.5 Implement a Logout button that clears `localStorage` and redirects to `/login`.

## 6. Verification

- [ ] 6.1 Manually verify successful user registration via the UI.
- [ ] 6.2 Manually verify successful login and token storage.
- [ ] 6.3 Manually verify that `/profile` displays correct information when logged in.
- [ ] 6.4 Manually verify that logging out successfully prevents access to `/profile`.
