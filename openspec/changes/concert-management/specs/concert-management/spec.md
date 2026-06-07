## Specification: Concert Management

## Description

The Concert Management feature enables Organizer users (promoters/organizers) to create, edit, cancel, and monitor concerts. It also enables Audience users to discover concerts, read concert metadata, view interactive SVG seat maps, and inspect real-time ticket availability.

---

## Main Flow

### 1. Concert Discovery (Audience)
1. **Audience** navigates to `/concerts` in the Web Application.
2. Web Application requests upcoming concerts from the Backend API (`GET /api/concerts`).
3. Backend API checks Redis for `concerts:list`.
   * **Cache Hit**: Returns the list.
   * **Cache Miss**: Queries PostgreSQL for all concerts with status `UPCOMING` or `ONGOING`, writes them to Redis cache (5-minute TTL), and returns the list.
4. Web Application renders a grid of concert cards.

### 2. View Concert Detail (Audience)
1. **Audience** clicks a concert to navigate to `/concerts/:id`.
2. Web Application requests details from Backend API (`GET /api/concerts/:id`).
3. Backend API checks Redis for `concerts:{id}`.
   * **Cache Hit**: Returns the static concert data.
   * **Cache Miss**: Queries PostgreSQL for the concert metadata and SVG seating map, writes to Redis (5-minute TTL), and returns it.
4. Backend API concurrently requests remaining tickets for the concert from Redis `concerts:{id}:tickets`.
   * **Cache Hit**: Returns remaining ticket counts per zone.
   * **Cache Miss**: Calculates remaining tickets from PostgreSQL (`totalQuantity - soldQuantity`), caches in Redis (30-second TTL), and returns them.
5. Web Application renders the details, countdown timers, status badges, and highlights interactive seat map zones.

### 3. Create Concert (Organizer)
1. **Organizer** navigates to `/admin/concerts/new`.
2. **Organizer** fills in concert details (name, artists, venue, dateTime, description, posterUrl, seatMapSvg) and configures ticket types (GA, VIP, SVIP, CAT1, CAT2) with pricing, quantities, sale windows, and max purchases.
3. Web Application sends creation payload to Backend API (`POST /api/concerts`).
4. Backend API validates fields and permissions:
   * Verify requester has the `ORGANIZER` role.
   * Verify all inputs are formatted correctly.
5. Backend API saves new records to PostgreSQL `concerts` and `ticket_types` inside a single transaction.
6. Backend API invalidates Redis cache key `concerts:list`.
7. **Organizer** is redirected to `/admin/concerts` with a success message.

### 4. Update Concert (Organizer)
1. **Organizer** navigates to `/admin/concerts/:id/edit`.
2. **Organizer** updates details and submits.
3. Backend API validates inputs and verifies the concert belongs to the requesting Organizer.
4. Backend API updates records in PostgreSQL `concerts`.
5. Backend API invalidates Redis cache keys `concerts:list` and `concerts:{id}`.

### 5. Cancel Concert (Organizer)
1. **Organizer** clicks "Cancel Concert" on the edit page.
2. Backend API verifies permissions and ownership.
3. Backend API updates the status of the concert to `CANCELLED` in PostgreSQL.
4. Backend API invalidates Redis cache keys `concerts:list` and `concerts:{id}`.

---

## Failure Scenarios

### 1. Redis Cache Service Unavailable
* **Given** the Redis service is offline or unreachable.
* **When** a user retrieves the concert list or concert details.
* **Then** the Backend API catches the connection exception, logs the error, falls back to direct PostgreSQL query execution, and serves the request normally (degraded performance but fully functional).

### 2. Unauthorized Management Attempt
* **Given** a user is logged in as `AUDIENCE` or `STAFF`.
* **When** they send a request to `POST /api/concerts` or `PUT /api/concerts/:id`.
* **Then** the Backend API guards block the action and return HTTP `403 Forbidden`.

### 3. Missing or Invalid SVG Code
* **Given** an Organizer submits a malformed or empty `seatMapSvg` field.
* **When** saving the concert.
* **Then** the Backend API rejects the request with HTTP `400 Bad Request` explaining that a valid SVG string is required.

### 4. Invalid Ticket Configuration
* **Given** an Organizer specifies a sale start time that occurs after the concert date/time.
* **When** saving the concert.
* **Then** the Backend API rejects the request with HTTP `400 Bad Request`.

---

## Constraints

1. **Role-Based Access Control**:
   * Creating, editing, and cancelling concerts require `ORGANIZER` authentication.
   * Access to stats endpoint `GET /api/concerts/:id/stats` is strictly restricted to the concert owner.
2. **Data Consistency**:
   * All concert creations and ticket-type associations must be completed in a transaction.
3. **Caching Freshness**:
   * Ticket count calculations must not be served from caches older than 30 seconds.

---

## Acceptance Criteria

### 1. Concert Discovery and Filtering
* **Given** a user browses the concert listing.
* **When** they load `/concerts`.
* **Then** they see a card grid displaying all upcoming concerts (name, date, venue, artists, thumbnail) fetched from the `concerts:list` cache.

### 2. Countdown and Buy State
* **Given** an upcoming concert whose ticket sale start time is in the future.
* **When** a user views the detail page `/concerts/:id`.
* **Then** they see a ticking countdown timer showing the remaining days/hours/minutes/seconds until the sale window opens, and the selection buttons are disabled.
* **Given** the ticket sale start time is in the past.
* **When** a user views the detail page `/concerts/:id`.
* **Then** they see active selection controls, remaining tickets, and a "Buy Ticket" action button.

### 3. Seating Map Interactivity
* **Given** the interactive SVG seat map on `/concerts/:id`.
* **When** a user hovers over a zone (e.g. VIP).
* **Then** the zone color highlights.
* **When** they click the zone.
* **Then** the corresponding ticket type is selected in the checkout sidebar.
* **Given** a zone is sold out (`soldQuantity == totalQuantity`).
* **When** a user hovers or clicks that zone.
* **Then** it shows as grayed-out, disabled, and labeled as "Sold Out".

### 4. Concert Cancellation Visibility
* **Given** a concert status is updated to `CANCELLED`.
* **When** a user opens `/concerts/:id`.
* **Then** they see a red cancellation banner at the top, and all checkout actions are completely disabled.
