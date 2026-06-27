## 1. Router protection

- [x] 1.1 Wrap the `/organizer/concerts`, `/organizer/concerts/new`, and `/organizer/concerts/:id/edit` routes with the existing `RequireOrganizer` guard
- [x] 1.2 Verify organizer access remains available and non-organizer access redirects to `/concerts`

## 2. Admin dashboard navigation

- [x] 2.1 Update the "Concert Management" card so it navigates to `/organizer/concerts`
- [x] 2.2 Add a minimal interactive affordance for that card without changing the other cards

## 3. Verification

- [x] 3.1 Run relevant frontend tests or build checks for router and dashboard behavior
- [x] 3.2 Confirm no backend or unrelated routes were modified
