# Proposal: Authentication and Role-Based Access Control (RBAC)

## Problem

A modern concert ticketing system requires a secure identity verification mechanism to distinguish between standard users buying tickets, organizers setting up and managing events, and gate staff checking in attendees. Without robust Authentication and Role-Based Access Control (RBAC):
- Audience users cannot safely view their own purchased tickets.
- Unauthenticated users could perform administrative actions like updating concert parameters or accessing sensitive sales statistics.
- Check-in staff could access non-event APIs, leading to a breakdown of segregation of duties.

This proposal introduces a centralized registration and token-based login flow with server-side role management to enforce access restrictions.

## Goals

1. Enforce strict **Authentication** via JWT for all non-public routes (buying tickets, viewing ticket orders, administration, check-ins).
2. Establish a **Role-Based Access Control (RBAC)** hierarchy with three fixed roles: `AUDIENCE` (default self-registered), `ORGANIZER` (privileged/seeded admin), and `STAFF` (limited check-in capabilities).
3. Securely store and handle passwords on the backend using bcrypt hashing.
4. Protect React single-page application routes on the client side using router-based guards (`ProtectedRoute`, `RoleRoute`) while storing credentials securely in local storage.

## Users and Needs

* **Audience**: Needs to register an account, log in using their email and password, retrieve their details, and buy tickets safely.
* **Organizer**: Needs to access admin areas, manage concert setups, promote/create `STAFF` accounts for gate check-ins, and inspect revenue statistics.
* **Staff**: Needs to log in with organizer-generated credentials and access check-in validation views.

## Scope

### In Scope
* **Backend (NestJS)**:
  * Database schema with role enum (`AUDIENCE`, `ORGANIZER`, `STAFF`) on the `User` model.
  * Public registration endpoint: `POST /api/auth/register` (creates `AUDIENCE` users).
  * Public login endpoint: `POST /api/auth/login` (verifies credentials, generates JWT).
  * Profile endpoint: `GET /api/auth/me` (requires validated JWT token).
  * Staff registration endpoint: `POST /api/admin/staff` (restricted to `ORGANIZER`, creates a `STAFF` user).
  * Passport JWT strategy configuration (7 days token lifespan).
  * Route level security via NestJS guards (`JwtAuthGuard`, `RolesGuard`) and custom decorators (`@Roles()`).
* **Frontend (React)**:
  * Pages for `/login` and `/register`.
  * `AuthContext` to persist authorization tokens (localStorage) and user metadata globally.
  * Route validation decorators/components (`ProtectedRoute`, `RoleRoute`) to handle redirection of unauthorized views.
* **Seed Data**:
  * 5 sample accounts: 1 `ORGANIZER`, 1 `STAFF`, and 3 `AUDIENCE` accounts.

### Out of Scope
* Forgot password, password recovery, or password reset tokens.
* Email verification/activation links.
* OAuth login integrations (Google, Facebook, Apple, GitHub).
* Multi-Factor Authentication (MFA).
* Refresh token rotation mechanisms.

## External Systems
* No external authentication providers (e.g. Auth0, Firebase Auth, AWS Cognito). Local JWT generation and verification.

## Risks and Constraints
* **Token Exposure**: Since tokens are stored in the browser's `localStorage`, the frontend is potentially vulnerable to Cross-Site Scripting (XSS) attacks. Security headers must be in place, and cookies could be considered in a future refinement if requested.
* **Privileged Staff Accounts**: Staff credentials are created manually by Organizers. Organizers must be validated before allowing them to trigger `POST /api/admin/staff`.
