## Overview

This change turns the frontend from a broad project-foundation shell into a narrow authentication shell. The structure should make future domain features easy to add without letting the current authentication UI sprawl across `App.tsx`.

## Source Layout

Target layout:

```text
frontend/src/
  app/
    App.tsx
    router.tsx
  components/
    layout/
      AppShell.tsx
      AuthLayout.tsx
    ui/
      Alert.tsx
      Button.tsx
      FormField.tsx
  features/
    auth/
      api.ts
      types.ts
      pages/
        LoginPage.tsx
        RegisterPage.tsx
  lib/
    api-client.ts
    config.ts
  pages/
    HomePage.tsx
  test/
    setup.ts
  main.tsx
  styles.css
```

The exact file split can stay pragmatic during implementation, but feature-specific auth API and auth pages should live under `features/auth`, while app routing and layout should not stay inside one large root component.

## Routing

The frontend should expose only:

- `/`
- `/login`
- `/register`

`/` renders an intentionally empty or minimal home screen. It should not display fake concert lists, fake ticket states, fake organizer analytics, or an old health-dashboard style shell.

`/register` submits to the backend registration endpoint. On success, it displays success feedback and navigates the user to `/login`.

`/login` submits to the backend login endpoint. On success, it stores `accessToken` and navigates the user to `/`.

## UI Direction

Login and register should share layout and controls. The design should feel like a real TicketBox product surface rather than a default form:

- centered auth layout with clear hierarchy
- Vietnamese user-facing copy
- responsive form width
- visible focus, error, loading, and success states
- no large inline style objects in page components
- buttons and inputs sized consistently

The home page should stay deliberately quiet because the user requested it to be empty. Navigation may expose the app name and auth links, but should not introduce additional screens.

## API Integration

The existing configured API base URL behavior should remain. Auth calls should use shared API utilities so future features do not duplicate fetch error handling.

The JWT payload and RBAC logic remain backend concerns. The frontend stores the access token only for subsequent API calls and does not infer permissions from token contents.

## Testing Strategy

Frontend tests should verify the shell behavior without requiring a running backend:

- app renders with router wiring
- `/login` renders the login form
- `/register` renders the register form
- successful register calls the register endpoint and routes toward login
- successful login stores `accessToken` and routes home

Network calls should be mocked in tests.
