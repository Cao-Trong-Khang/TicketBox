## Why

We need a basic authentication frontend to allow users to register, log in, and view their profile. This MVP establishes the foundation for the frontend application to interact with the backend auth endpoints and securely manage the access token before we build more complex business flows like purchasing tickets or managing concerts.

## What Changes

- Implement `react-router-dom` for client-side routing.
- Create an API client utility (`src/lib/api.ts`) that handles setting the `Authorization` header and basic error parsing.
- Implement `/register` page with basic client-side validation.
- Implement `/login` page that stores the JWT `accessToken` in `localStorage`.
- Implement `/profile` page that calls `/auth/me` to display user information and provides a logout mechanism.
- Add minimal styling using existing CSS infrastructure.

## Capabilities

### New Capabilities
- `frontend-auth-mvp`: Basic frontend authentication UI connecting to existing backend auth endpoints.

### Modified Capabilities

## Impact

- **Frontend:** Adds `react-router-dom` dependency. Introduces global API utility. Creates foundational pages that future routes will build upon.
- **Backend:** None. Uses existing `/auth/register`, `/auth/login`, and `/auth/me` endpoints.
- **Roles:** Primarily targets Audience registration, but sets the pattern for all future authenticated users.
