## Specification: Authentication and RBAC

## Description

The Authentication and Role-Based Access Control (RBAC) feature secures TicketBox resources and enforces permissions across distinct users. Registering a standard audience account, logging in, managing staff accounts, and guarding dashboard routes are encapsulated in this spec.

---

## Main Flow

### 1. Audience User Registration
1. **Audience** navigates to `/register` in the Web Application.
2. **Audience** inputs `email` and `password` and clicks Register.
3. Web Application posts data to Backend API (`POST /api/auth/register`).
4. Backend API validates that:
   * The email is correctly formatted and unique in PostgreSQL.
   * The password satisfies length constraints.
5. Backend API hashes the password using bcrypt (10 rounds) and persists the user record with the role set to `AUDIENCE`.
6. Registration completes, and the user is redirected to `/login`.

### 2. User Login and Session Management
1. **User** (Audience, Organizer, or Staff) navigates to `/login`.
2. **User** inputs credentials and submits.
3. Web Application posts to Backend API (`POST /api/auth/login`).
4. Backend API queries PostgreSQL for the user profile by email:
   * Verify password hash using bcrypt.
   * Generate JWT payload: `{ sub: userId, email, role }`.
   * Return JWT token response.
5. Web Application receives the token and stores it in `localStorage` inside `AuthContext`.
6. Web Application decodes the token claims and navigates the user to their appropriate landing area (e.g., Organizer to `/admin/concerts`, Audience to `/concerts`).

### 3. Retrieve Session Profile
1. On application reload, the Web Application requests user profiles using the token (`GET /api/auth/me`).
2. Backend API processes the token using `JwtAuthGuard`.
3. Backend API queries the user profile and returns fields (id, email, role) omitting `passwordHash`.
4. `AuthContext` initializes the state, hiding loading spinners.

### 4. Create Staff Account (Organizer)
1. **Organizer** logs in and navigates to the staff creation form.
2. **Organizer** fills in email and password for a staff member and submits.
3. Web Application requests staff creation (`POST /api/admin/staff`) with Bearer token.
4. Backend API parses request:
   * `JwtAuthGuard` verifies Organizer identity.
   * `RolesGuard` verifies organizer role matches `ORGANIZER`.
5. Backend API hashes the staff password and inserts the user into PostgreSQL with the role `STAFF`.
6. Returns success indicator.

---

## Failure Scenarios

### 1. Registration with Duplicate Email
* **Given** an email address already exists in the `users` table.
* **When** a new user attempts registration using the same email address.
* **Then** the Backend API halts transaction execution and returns HTTP `400 Bad Request` or `409 Conflict` (Email already registered).

### 2. Invalid Credentials Login
* **Given** a user inputs an email that does not exist or a password mismatch.
* **When** they attempt to login.
* **Then** the Backend API returns HTTP `401 Unauthorized` with a generic message ("Invalid credentials") to prevent user enumeration.

### 3. Route Guard Bypass (Direct API Call)
* **Given** an unauthenticated client directly requests `/api/auth/me`.
* **When** they make the request without an Authorization header or with a malformed JWT.
* **Then** `JwtAuthGuard` intercepts the call, rejects processing, and returns HTTP `401 Unauthorized`.

### 4. Unauthorized Administrative Request
* **Given** a logged-in `AUDIENCE` user attempts to create staff via `POST /api/admin/staff`.
* **When** they submit the request.
* **Then** `RolesGuard` determines the user does not possess the `ORGANIZER` role, rejects execution, and returns HTTP `403 Forbidden`.

### 5. Client Route Redirection (Frontend)
* **Given** a logged-in user with role `AUDIENCE` tries to navigate to `/admin/concerts`.
* **When** the React router resolves the path.
* **Then** `RoleRoute` intercepts the routing, evaluates the user's role constraint, blocks access, and redirects them to `/403` or `/concerts` with a warning message.

---

## Constraints

1. **Password Hashing**: Passwords must never be saved in plaintext. Hashing is mandated using bcrypt with exactly 10 salt rounds.
2. **Access token lifespan**: JWT tokens must expire after 7 days.
3. **Roles Mutability**: Roles of users must be fixed to the enum values (`AUDIENCE`, `ORGANIZER`, `STAFF`) and cannot be manipulated by public users.

---

## Acceptance Criteria

### 1. User Self-Registration
* **Given** a new audience member.
* **When** they submit email and password via registration form.
* **Then** a user record with role `AUDIENCE` is created in PostgreSQL, and the password is secure (hashed).

### 2. Login Token Issuance
* **Given** a registered user.
* **When** they provide correct credentials at login.
* **Then** the system returns a JWT signed payload containing `sub`, `email`, and `role`, which the frontend stores in local storage.

### 3. Identity and Authorization Checking
* **Given** a controller method decorated with `@Roles(UserRole.ORGANIZER)`.
* **When** a user authenticated as `STAFF` or `AUDIENCE` accesses it.
* **Then** the endpoint rejects execution with HTTP `403 Forbidden`.
* **Given** the user is authenticated as `ORGANIZER`.
* **When** they access the decorated method.
* **Then** the API allows successful execution.

### 4. Client Page Route Guards
* **Given** an unauthenticated visitor.
* **When** they try to open `/admin` or `/checkin` links.
* **Then** they are blocked and redirected to `/login`.
* **Given** an authenticated audience user.
* **When** they try to access `/admin/concerts`.
* **Then** the React Router blocks mounting and redirects them to an unauthorized screen.
