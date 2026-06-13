## Overview

This is a structural refactor. The goal is to make the backend read like a modular monolith:

```text
src/
  app.module.ts
  main.ts
  worker.ts

  config/
  prisma/

  modules/
    auth/
    health/
    rbac/
```

The useful distinction:

- `modules/*` owns application capabilities.
- `config` and `prisma` are infrastructure.
- `common` is reserved for truly generic helpers, not domain vocabulary.

## Target Structure

```text
backend/src/
  app.module.ts
  main.ts
  worker.ts

  config/
    app.config.ts
    app-config.module.ts

  prisma/
    prisma.module.ts
    prisma.service.ts

  common/
    decorators/
    guards/
    filters/
    pipes/
    types/

  modules/
    auth/
      auth.controller.ts
      auth.module.ts
      auth.service.ts
      auth.spec.ts
      jwt-auth.guard.ts
      jwt.strategy.ts
      types.ts
      dto/
        login.dto.ts
        register.dto.ts

    health/
      health.controller.ts
      health.module.ts
      health.service.ts
      health.service.spec.ts

    rbac/
      rbac.module.ts
      permission.service.ts
      permissions.decorator.ts
      permissions.guard.ts
      rbac.constants.ts
      rbac-test.controller.ts
```

`common` may exist as a reserved folder, but this change should not move RBAC-specific or auth-specific files into it just because they are reused. Reuse should happen through module exports.

## Ownership Rules

### Auth Owns Authentication

`modules/auth` owns:

- registration
- login
- JWT strategy
- `JwtAuthGuard`
- auth request DTOs
- auth response/user/token types

Auth may import infrastructure:

```text
modules/auth -> prisma
modules/auth -> config
```

Auth should not own permission decisions.

### RBAC Owns Authorization Vocabulary

`modules/rbac` owns:

- `@Permissions()`
- `PermissionsGuard`
- `PermissionService`
- RBAC permission/role constants
- RBAC test endpoints while this remains a foundation/demo project

RBAC may import:

```text
modules/rbac -> prisma
modules/rbac -> modules/auth/types or a shared authenticated-user type
```

If the implementation wants to avoid `rbac -> auth` imports, it may move only the generic `AuthenticatedUser` request type into `common/types`. It should not move the guard, decorator, or constants out of RBAC.

### Infrastructure Is Not a Feature Module

`config` and `prisma` sit directly under `src` because they are infrastructure used by multiple modules. They should not contain business logic.

## Dependency Shape

Expected dependency direction:

```text
              app.module.ts
                   │
      ┌────────────┼────────────┐
      ▼            ▼            ▼
 modules/auth  modules/rbac  modules/health
      │            │            │
      ├──────┐     └──────┐     │
      ▼      ▼            ▼     ▼
   prisma  config       prisma config
```

Domain modules added later should import auth/RBAC tools explicitly:

```text
modules/concerts
  -> JwtAuthGuard from modules/auth
  -> PermissionsGuard, Permissions from modules/rbac
```

## Refactor Safety Rules

This change should be mostly mechanical:

1. Move files.
2. Update imports.
3. Keep class names, exported names, route paths, DTO validation, Prisma calls, and guard logic unchanged.
4. Run tests/build/lint.
5. Verify auth and RBAC behavior still matches existing specs.

Do not combine this with behavior cleanup. For example:

- Do not rewrite permission queries.
- Do not change JWT payload.
- Do not change role codes.
- Do not remove default `AUDIENCE` assignment.
- Do not change endpoint paths.
- Do not alter Prisma schema/migrations/seed data.

## Verification Strategy

The strongest signal is existing tests continuing to pass after imports are updated. At minimum, verify:

- backend build
- backend tests
- lint, if configured
- auth registration/login tests
- RBAC 401/403/200 tests

Manual smoke tests remain useful after implementation:

```text
POST /auth/register
POST /auth/login
GET /auth/me
GET /rbac-test/concert-create
GET /rbac-test/ticket-purchase
```
