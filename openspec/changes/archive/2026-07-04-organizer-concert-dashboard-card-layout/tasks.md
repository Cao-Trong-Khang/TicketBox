## 1. Backend organizer concert list payload

- [x] 1.1 Add `bannerUrl` and `venueAddress` to the organizer concert list DTO and frontend-facing response contract for `GET /organizer/concerts`.
- [x] 1.2 Update `OrganizerConcertsService.listOwnedConcerts()` Prisma select and list-item mapper to return `bannerUrl` and `venueAddress` while preserving organizer ownership filtering and `createdAt DESC` ordering.
- [x] 1.3 Update backend tests for organizer concert list responses to verify owned concerts include `bannerUrl` and `venueAddress`.

## 2. Frontend organizer card and dashboard

- [x] 2.1 Update organizer frontend types and API consumers so organizer concert list items include `bannerUrl` and `venueAddress`.
- [x] 2.2 Create an organizer-specific concert card component that visually matches the audience `ConcertCard` layout with banner, title, artist, performance time, and full venue/location metadata.
- [x] 2.3 Add organizer lifecycle/status badge rendering to the organizer card without changing the underlying status or cancel rules.
- [x] 2.4 Replace the organizer dashboard stacked list with a responsive organizer card grid and wire the existing `Sửa` navigation to the current edit route.
- [x] 2.5 Replace the audience footer action with organizer-only footer actions so organizer cards render only `Sửa` and `Hủy` and never render `Xem chi tiết`.
- [x] 2.6 Preserve the existing cancel flow, pending-cancel state, and disabled-action behavior when concerts are not cancelable or editable.

## 3. Styling and regression protection

- [x] 3.1 Add focused organizer card styles that align with the audience card presentation while keeping public audience card behavior unchanged.
- [x] 3.2 Ensure organizer cards show the real banner image when `bannerUrl` exists and use the existing empty-banner fallback only when the banner is absent or fails to load.
- [x] 3.3 Verify responsive mobile and desktop layouts for organizer cards, including badge and footer action wrapping.

## 4. Tests and verification

- [x] 4.1 Add or update frontend tests to verify organizer cards render banner, venue/location metadata, and only `Sửa`/`Hủy` actions.
- [x] 4.2 Add or update frontend tests to verify `Sửa` keeps using the existing edit route and `Hủy` keeps using the existing cancel flow.
- [x] 4.3 Run backend and frontend test/build/lint commands and confirm the public audience concert list and organizer dashboard both work without regression.
