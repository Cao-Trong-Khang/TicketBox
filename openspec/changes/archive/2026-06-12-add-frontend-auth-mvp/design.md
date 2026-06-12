## Context

The backend already has authentication endpoints (`POST /auth/register`, `POST /auth/login`, `GET /auth/me`) functioning and protected via RBAC/JWT. However, the frontend currently lacks any UI to interact with these endpoints. We need to build a minimum viable product (MVP) frontend authentication flow to test registration, login, and token management before proceeding to complex features like ticket purchasing.

## Goals / Non-Goals

**Goals:**
- Implement client-side routing using `react-router-dom`.
- Create a reusable API client that automatically attaches the JWT `accessToken` from `localStorage`.
- Provide basic UI for `/register`, `/login`, and `/profile`.
- Ensure proper error handling and display for 400, 401, and 409 errors.

**Non-Goals:**
- Building full business screens (e.g., concert listing, checkout).
- Implementing complex UI tests for RBAC.
- Adding refresh token rotation (sticking to simple access token MVP).
- Redesigning the entire application UI (using existing basic CSS).

## Decisions

1. **Client-Side Routing:** We will use `react-router-dom` for navigation between public and protected routes.
   *Rationale:* Standard in the React ecosystem, easy to set up for MVP.
2. **API Client Wrapper:** We will implement a custom `fetch` wrapper in `src/lib/api.ts` instead of installing Axios.
   *Rationale:* `fetch` is built-in and sufficient for MVP needs. It keeps the dependency tree small. The wrapper will handle reading `VITE_API_BASE_URL` and auto-attaching `Authorization: Bearer <token>`.
3. **State Management:** We will use simple React component state (`useState`) and `localStorage` for the token.
   *Rationale:* Overkill to introduce Redux or Zustand just for an MVP auth flow.
4. **Protected Route Logic:** The `/profile` component itself will fetch `/auth/me` on mount. If it receives a 401, it redirects to `/login`.
   *Rationale:* Simple and effective for an MVP. A dedicated `<ProtectedRoute>` wrapper can be added later if needed.

## Risks / Trade-offs

- **Risk:** Storing JWT in `localStorage` is vulnerable to XSS.
  *Mitigation:* For an MVP, this is acceptable. Future iterations could move to `httpOnly` cookies if required by security policies.
- **Risk:** No global state for user context.
  *Mitigation:* Pages fetch their own data or read from `localStorage`. For MVP, only `/profile` needs the user data.

## Open Questions

- None at this time.
