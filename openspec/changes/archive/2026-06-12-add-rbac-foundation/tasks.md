## 1. Data Model and Migration

- [x] 1.1 Update Prisma schema with `Role`, `Permission`, `UserRole`, and `RolePermission` models and relations to `User`.
- [x] 1.2 Add unique constraints for `roles.code`, `permissions.code`, `user_roles(user_id, role_id)`, and `role_permissions(role_id, permission_id)`.
- [x] 1.3 Create the RBAC migration SQL for `roles`, `permissions`, `user_roles`, and `role_permissions`.
- [x] 1.4 Generate Prisma Client and verify the RBAC migration on a clean Docker PostgreSQL schema.

## 2. Seed Data

- [x] 2.1 Add a Prisma seed script that upserts roles `AUDIENCE`, `ORGANIZER`, and `CHECKIN_STAFF`.
- [x] 2.2 Seed permissions `concert:read`, `concert:create`, `concert:update`, `concert:cancel`, `concert:ticket_type:manage`, `concert:analytics:read`, `ticket:purchase`, `ticket:read_own`, `checkin:scan`, and `checkin:sync`.
- [x] 2.3 Seed role-permission mappings for Audience, Organizer, and Check-in Staff according to the RBAC design.
- [x] 2.4 Make the seed script idempotent and document/run it through an npm script.

## 3. Permission Infrastructure

- [x] 3.1 Implement `PermissionService.getUserPermissions(userId)` to load granted permission codes through all user roles.
- [x] 3.2 Implement `PermissionService.userHasPermissions(userId, requiredPermissions)` with require-all semantics.
- [x] 3.3 Implement `@Permissions()` decorator using NestJS metadata.
- [x] 3.4 Implement `PermissionsGuard` that reads metadata, uses `req.user.id`, returns `403 Forbidden` when permissions are missing, and does not read JWT role or permission claims.
- [x] 3.5 Register the RBAC module or providers so future feature modules can use the service, decorator, and guard.

## 4. Registration Default Role

- [x] 4.1 Update registration to create the user and assign the `AUDIENCE` role in a single transaction.
- [x] 4.2 Ensure registration fails clearly if the `AUDIENCE` role has not been seeded.
- [x] 4.3 Keep the login JWT payload identity-only with no role or permission claims.

## 5. Verification Endpoints and Tests

- [x] 5.1 Add sample RBAC-protected endpoints for `concert:create` and `ticket:purchase` verification.
- [x] 5.2 Add tests proving no token returns `401 Unauthorized` for permission-protected endpoints.
- [x] 5.3 Add tests proving a logged-in user without `concert:create` receives `403 Forbidden`.
- [x] 5.4 Add tests proving a user with `ORGANIZER` receives `200` for `concert:create`.
- [x] 5.5 Add tests proving `ORGANIZER` alone cannot access `ticket:purchase`, while `ORGANIZER` plus `AUDIENCE` can.
- [x] 5.6 Add tests proving registration assigns `AUDIENCE` through `user_roles`.
- [x] 5.7 Add tests proving JWT payload still excludes role and permission claims.
- [x] 5.8 Run backend build, lint, tests, and local Docker PostgreSQL migration/seed verification.
