# Tasks: Authentication and RBAC Implementation

This list details the required execution steps to implement the Authentication and Role-Based Access Control (RBAC) feature using NestJS backend and React/Vite frontend.

---

## 1. Database

- [ ] **Task DB-1**: Add `User` model with `UserRole` enum (`AUDIENCE`, `ORGANIZER`, `STAFF`) to the Prisma schema file. (Maps to: *User Self-Registration*)
- [ ] **Task DB-2**: Generate and run the database migration. (Maps to: *User Self-Registration*)
- [ ] **Task DB-3**: Implement a seed script inserting the 5 standard accounts:
  * `organizer@ticketbox.vn` with role `ORGANIZER`.
  * `staff@ticketbox.vn` with role `STAFF`.
  * 3 default audience members.
  All passwords hashed using bcrypt (10 rounds). (Maps to: *Login Token Issuance*)

---

## 2. Backend (NestJS)

- [ ] **Task BE-1**: Create `UsersModule` and `AuthModule`. Register services and controllers. (Maps to: *User Self-Registration*)
- [ ] **Task BE-2**: Install dependencies (`@nestjs/jwt`, `@nestjs/passport`, `passport`, `passport-jwt`, `bcrypt`, `@types/bcrypt`, `@types/passport-jwt`). (Maps to: *User Self-Registration*)
- [ ] **Task BE-3**: Implement password hashing and validation logic within `AuthService` using `bcrypt` (10 rounds). (Maps to: *User Self-Registration*)
- [ ] **Task BE-4**: Implement `POST /api/auth/register` (creates `AUDIENCE` users). (Maps to: *User Self-Registration*)
- [ ] **Task BE-5**: Implement `POST /api/auth/login` returning a signed JWT token containing user details with a 7-day expiration. (Maps to: *Login Token Issuance*)
- [ ] **Task BE-6**: Implement `JwtStrategy`, `JwtAuthGuard`, `@Roles()` decorator, and `RolesGuard` evaluating token metadata. (Maps to: *Identity and Authorization Checking*)
- [ ] **Task BE-7**: Implement `GET /api/auth/me` guarded by `JwtAuthGuard`. (Maps to: *Identity and Authorization Checking*)
- [ ] **Task BE-8**: Implement `POST /api/admin/staff` restricted to `ORGANIZER` to register staff accounts. (Maps to: *Identity and Authorization Checking*)

---

## 3. Frontend (React + Vite)

- [ ] **Task FE-1**: Implement `AuthContext` to manage authenticated state, handle token storage in `localStorage`, handle logins, registration, and logouts. (Maps to: *Login Token Issuance*)
- [ ] **Task FE-2**: Implement `ProtectedRoute` (blocking unauthenticated users) and `RoleRoute` (blocking mismatched roles). (Maps to: *Client Page Route Guards*)
- [ ] **Task FE-3**: Implement `/login` page forms linking submit handlers to `AuthContext.login`. (Maps to: *Login Token Issuance*)
- [ ] **Task FE-4**: Implement `/register` page forms linking submit handlers to `AuthContext.register`. (Maps to: *User Self-Registration*)
- [ ] **Task FE-5**: Configure application routing in `App.tsx`, applying route guards:
  * `/admin/*` protected with `ORGANIZER` restriction.
  * `/checkin/*` protected with `STAFF` restriction.
  * `/concerts` and `/concerts/:id` public. (Maps to: *Client Page Route Guards*)
