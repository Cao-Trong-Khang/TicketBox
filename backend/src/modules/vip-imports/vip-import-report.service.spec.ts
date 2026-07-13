import * as assert from 'node:assert/strict';
import { test } from 'node:test';
import { ForbiddenException } from '@nestjs/common';
import { ImportErrorType, ImportStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { PermissionService } from '../rbac/permission.service';
import { PERMISSION_CODES, ROLE_CODES } from '../rbac/rbac.constants';
import { VipImportReportService } from './vip-import-report.service';

type TestState = {
  userRoles: { userId: string; role: { code: string } }[];
  userPermissions: Record<string, string[]>;
  concerts: { id: string; organizerId: string }[];
  imports: ImportRecord[];
  errors: ImportErrorRecord[];
  auditLogs: AuditLogRecord[];
};

type ImportRecord = {
  id: string;
  concertId: string;
  sourceName: string;
  fileName: string;
  sourcePath: string | null;
  sourceFingerprint: string;
  status: ImportStatus;
  totalRows: number;
  acceptedRows: number;
  rejectedRows: number;
  duplicateRows: number;
  failureCode: string | null;
  failureMessage: string | null;
  queuedAt: Date | null;
  startedAt: Date | null;
  importedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

type ImportErrorRecord = {
  id: string;
  importId: string;
  type: ImportErrorType;
  rowNumber: number | null;
  field: string | null;
  code: string;
  message: string;
  rawRow: unknown;
  metadata: unknown;
  createdAt: Date;
};

type AuditLogRecord = {
  id: string;
  importId: string | null;
  action: string;
  metadata: unknown;
  createdAt: Date;
};

test('owning organizer can list and inspect VIP import reports', async () => {
  const { service } = createHarness();

  const list = await service.listImportsForConcert(
    { id: 'organizer-1', email: 'organizer@example.test' },
    'concert-1',
  );
  const detail = await service.getImportForConcert(
    { id: 'organizer-1', email: 'organizer@example.test' },
    'concert-1',
    'import-1',
  );

  assert.equal(list.length, 1);
  assert.equal(list[0].status, ImportStatus.COMPLETED);
  assert.equal(list[0].acceptedRows, 2);
  assert.equal(list[0].errorCount, 2);
  assert.equal(detail.errors.length, 2);
  assert.equal(detail.errors[0].code, 'EMAIL_INVALID');
  assert.equal(detail.auditTrail[0].action, 'vip_import.completed');
});

test('non-owning organizer cannot review another organizer concert import report', async () => {
  const { service } = createHarness();

  await assert.rejects(
    () =>
      service.listImportsForConcert(
        { id: 'organizer-2', email: 'organizer2@example.test' },
        'concert-1',
      ),
    ForbiddenException,
  );
});

test('Audience user cannot review VIP import reports', async () => {
  const { service } = createHarness();

  await assert.rejects(
    () =>
      service.getImportForConcert(
        { id: 'audience-1', email: 'audience@example.test' },
        'concert-1',
        'import-1',
      ),
    ForbiddenException,
  );
});

test('Check-in Staff user cannot review VIP import reports', async () => {
  const { service } = createHarness();

  await assert.rejects(
    () =>
      service.getImportForConcert(
        { id: 'staff-1', email: 'staff@example.test' },
        'concert-1',
        'import-1',
      ),
    ForbiddenException,
  );
});

function createHarness(): { service: VipImportReportService; state: TestState } {
  const state = createState();
  const prisma = createPrismaMock(state);
  const permissionService = {
    userHasPermissions: async (userId: string, permissions: string[]) => {
      const grantedPermissions = new Set(state.userPermissions[userId] ?? []);
      return permissions.every((permission) => grantedPermissions.has(permission));
    },
  };

  return {
    service: new VipImportReportService(
      prisma as unknown as PrismaService,
      permissionService as PermissionService,
    ),
    state,
  };
}

function createState(): TestState {
  const now = new Date('2026-06-15T12:00:00.000Z');

  return {
    userRoles: [
      { userId: 'organizer-1', role: { code: ROLE_CODES.organizer } },
      { userId: 'organizer-2', role: { code: ROLE_CODES.organizer } },
      { userId: 'audience-1', role: { code: ROLE_CODES.audience } },
      { userId: 'staff-1', role: { code: ROLE_CODES.checkinStaff } },
    ],
    userPermissions: {
      'organizer-1': [PERMISSION_CODES.concertUpdate],
      'organizer-2': [PERMISSION_CODES.concertUpdate],
      'audience-1': [],
      'staff-1': [PERMISSION_CODES.checkinPreload],
    },
    concerts: [{ id: 'concert-1', organizerId: 'organizer-1' }],
    imports: [
      {
        id: 'import-1',
        concertId: 'concert-1',
        sourceName: 'LOCAL_DEMO',
        fileName: 'valid.csv',
        sourcePath: '/tmp/valid.csv',
        sourceFingerprint: 'fingerprint',
        status: ImportStatus.COMPLETED,
        totalRows: 4,
        acceptedRows: 2,
        rejectedRows: 1,
        duplicateRows: 1,
        failureCode: null,
        failureMessage: null,
        queuedAt: now,
        startedAt: now,
        importedAt: now,
        createdAt: now,
        updatedAt: now,
      },
    ],
    errors: [
      {
        id: 'error-1',
        importId: 'import-1',
        type: ImportErrorType.ROW,
        rowNumber: 3,
        field: 'email',
        code: 'EMAIL_INVALID',
        message: 'VIP guest email is malformed',
        rawRow: { email: 'not-an-email' },
        metadata: null,
        createdAt: now,
      },
      {
        id: 'error-2',
        importId: 'import-1',
        type: ImportErrorType.DUPLICATE,
        rowNumber: 4,
        field: null,
        code: 'DUPLICATE_IN_FILE',
        message: 'Guest identity is duplicated within the CSV file',
        rawRow: { external_guest_key: 'VIP-1' },
        metadata: { duplicateKey: 'external:vip-1' },
        createdAt: now,
      },
    ],
    auditLogs: [
      {
        id: 'audit-1',
        importId: 'import-1',
        action: 'vip_import.completed',
        metadata: { acceptedRows: 2 },
        createdAt: now,
      },
    ],
  };
}

function createPrismaMock(state: TestState) {
  return {
    userRole: {
      findMany: async ({ where }: { where: { userId: string } }) =>
        state.userRoles.filter((userRole) => userRole.userId === where.userId),
    },
    concert: {
      findUnique: async ({ where }: { where: { id: string } }) =>
        state.concerts.find((concert) => concert.id === where.id) ?? null,
    },
    vipGuestImport: {
      findMany: async ({ where }: { where: { concertId: string } }) =>
        state.imports
          .filter((importRecord) => importRecord.concertId === where.concertId)
          .map((importRecord) => ({
            ...importRecord,
            _count: {
              errors: state.errors.filter((error) => error.importId === importRecord.id).length,
            },
          })),
      findFirst: async ({ where }: { where: { id: string; concertId: string } }) => {
        const importRecord = state.imports.find(
          (candidate) => candidate.id === where.id && candidate.concertId === where.concertId,
        );

        if (!importRecord) {
          return null;
        }

        return {
          ...importRecord,
          errors: state.errors.filter((error) => error.importId === importRecord.id),
          auditLogs: state.auditLogs.filter((auditLog) => auditLog.importId === importRecord.id),
          _count: {
            errors: state.errors.filter((error) => error.importId === importRecord.id).length,
          },
        };
      },
    },
  };
}
