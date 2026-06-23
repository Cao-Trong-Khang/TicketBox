import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import test from 'node:test';
import { ImportErrorType, ImportStatus, Prisma, VipGuestStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { VipImportWorkerService } from './vip-import-worker.service';

type TestImport = {
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

type TestGuest = {
  id: string;
  importId: string;
  concertId: string;
  sponsorSource: string;
  externalGuestKey: string | null;
  qrHash: string | null;
  fullName: string;
  email: string | null;
  phone: string | null;
  sponsorCompany: string | null;
  invitedBy: string | null;
  guestType: string | null;
  allowedGate: string | null;
  notes: string | null;
  normalizedFullName: string;
  normalizedEmail: string | null;
  normalizedPhone: string | null;
  normalizedIdentityKey: string | null;
  sourceRowNumber: number | null;
  status: VipGuestStatus;
  checkedInAt: Date | null;
  importedAt: Date;
  createdAt: Date;
  updatedAt: Date;
};

type TestError = {
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

type TestState = {
  imports: TestImport[];
  guests: TestGuest[];
  errors: TestError[];
  auditLogs: { action: string; importId: string | null; metadata: unknown }[];
  guestCreateAttempts: number;
  failOnGuestCreateAttempt?: number;
  claimConflictStatus?: ImportStatus;
  concurrentGuestCreateConflict?: Partial<TestGuest>;
};

type FindManyImportArgs = {
  where?: {
    status?: {
      in?: ImportStatus[];
    };
  };
  take?: number;
};

type UpdateManyImportArgs = {
  where: {
    id?: string;
    status?: {
      in?: ImportStatus[];
    };
  };
  data: Partial<TestImport>;
};

test('worker imports valid unique VIP guests and marks the import completed', async () => {
  await withTempCsv(async (sourcePath) => {
    await writeFile(
      sourcePath,
      csv([
        'concert_title,sponsor_source,external_guest_key,full_name,email,phone,sponsor_company,invited_by,guest_type,allowed_gate,notes',
        'Demo Concert,LOCAL_DEMO,VIP-001,Demo Guest One,one@example.test,+84900000001,Media Partner,Press Desk,Press,Gate A,Seat near FOH',
        'Demo Concert,LOCAL_DEMO,,Demo Guest Two,two@example.test,+84900000002,Artist Team,Manager,Artist Guest,VIP Gate,Green room',
      ]),
      'utf8',
    );
    const state = createState(sourcePath);
    const worker = createWorker(state);

    const result = await worker.processImport('import-1');

    assert.equal(result.status, ImportStatus.COMPLETED);
    assert.equal(result.totalRows, 2);
    assert.equal(result.acceptedRows, 2);
    assert.equal(result.rejectedRows, 0);
    assert.equal(result.duplicateRows, 0);
    assert.equal(state.guests.length, 2);
    assert.equal(state.guests[0].sponsorCompany, 'Media Partner');
    assert.equal(state.guests[0].guestType, 'Press');
    assert.equal(state.guests[0].allowedGate, 'Gate A');
    assert.equal(state.errors.length, 0);
    assert.deepEqual(
      state.auditLogs.map((entry) => entry.action),
      ['vip_import.processing', 'vip_import.completed'],
    );
  });
});

test('worker stores file-level errors without deleting existing accepted VIP guests', async () => {
  await withTempCsv(async (sourcePath) => {
    await writeFile(
      sourcePath,
      csv([
        'concert_title,sponsor_source,external_guest_key,email,phone',
        'Demo Concert,LOCAL_DEMO,VIP-001,missing-name@example.test,+84900000001',
      ]),
      'utf8',
    );
    const state = createState(sourcePath);
    state.guests.push(createGuest({ id: 'existing-vip', importId: 'previous-import' }));
    const worker = createWorker(state);

    const result = await worker.processImport('import-1');

    assert.equal(result.status, ImportStatus.FAILED);
    assert.equal(state.imports[0].failureCode, 'MISSING_REQUIRED_COLUMNS');
    assert.equal(state.errors.length, 1);
    assert.equal(state.errors[0].type, ImportErrorType.FILE);
    assert.equal(state.guests.length, 1);
    assert.equal(state.guests[0].id, 'existing-vip');
  });
});

test('worker records malformed rows while importing valid rows', async () => {
  await withTempCsv(async (sourcePath) => {
    await writeFile(
      sourcePath,
      csv([
        'concert_title,sponsor_source,external_guest_key,full_name,email,phone',
        'Demo Concert,LOCAL_DEMO,VIP-BAD-001,,missing-name@example.test,+84900000001',
        'Demo Concert,LOCAL_DEMO,VIP-BAD-002,Invalid Email,not-an-email,+84900000002',
        'Demo Concert,LOCAL_DEMO,,No Contact,,',
        'Demo Concert,LOCAL_DEMO,VIP-GOOD-001,Valid Guest,valid@example.test,+84900000003',
      ]),
      'utf8',
    );
    const state = createState(sourcePath);
    const worker = createWorker(state);

    const result = await worker.processImport('import-1');

    assert.equal(result.status, ImportStatus.COMPLETED);
    assert.equal(result.totalRows, 4);
    assert.equal(result.acceptedRows, 1);
    assert.equal(result.rejectedRows, 3);
    assert.equal(state.guests.length, 1);
    assert.deepEqual(
      state.errors.map((error) => error.code).sort(),
      ['EMAIL_INVALID', 'FULL_NAME_REQUIRED', 'IDENTITY_REQUIRED'],
    );
  });
});

test('worker deduplicates by external key first and normalized identity fallback', async () => {
  await withTempCsv(async (sourcePath) => {
    await writeFile(
      sourcePath,
      csv([
        'concert_title,sponsor_source,external_guest_key,full_name,email,phone',
        'Demo Concert,LOCAL_DEMO,VIP-DUP-001,Duplicate One,one@example.test,+84900000001',
        'Demo Concert,LOCAL_DEMO,VIP-DUP-001,Duplicate Two,two@example.test,+84900000002',
        'Demo Concert,LOCAL_DEMO,,Identity Duplicate,identity@example.test,+84900000003',
        'Demo Concert,LOCAL_DEMO,, identity   duplicate ,IDENTITY@example.test,+84 900 000 003',
      ]),
      'utf8',
    );
    const state = createState(sourcePath);
    const worker = createWorker(state);

    const result = await worker.processImport('import-1');

    assert.equal(result.status, ImportStatus.COMPLETED);
    assert.equal(result.acceptedRows, 2);
    assert.equal(result.duplicateRows, 2);
    assert.equal(state.guests.length, 2);
    assert.equal(state.errors.filter((error) => error.type === ImportErrorType.DUPLICATE).length, 2);
  });
});

test('worker records concurrent guest create conflicts as duplicate existing guests', async () => {
  await withTempCsv(async (sourcePath) => {
    await writeFile(
      sourcePath,
      csv([
        'concert_title,sponsor_source,external_guest_key,full_name,email,phone',
        'Demo Concert,LOCAL_DEMO,VIP-RACE-001,Race Guest,race@example.test,+84900000001',
      ]),
      'utf8',
    );
    const state = createState(sourcePath);
    state.concurrentGuestCreateConflict = {
      id: 'guest-created-by-other-import',
      importId: 'other-import',
    };
    const worker = createWorker(state);

    const result = await worker.processImport('import-1');

    assert.equal(result.status, ImportStatus.COMPLETED);
    assert.equal(result.acceptedRows, 0);
    assert.equal(result.duplicateRows, 1);
    assert.equal(state.guests.length, 1);
    assert.equal(state.guests[0].importId, 'other-import');
    assert.equal(state.errors.length, 1);
    assert.equal(state.errors[0].code, 'DUPLICATE_EXISTING_GUEST');
  });
});

test('worker retry is idempotent for an already processed import', async () => {
  await withTempCsv(async (sourcePath) => {
    await writeFile(
      sourcePath,
      csv([
        'concert_title,sponsor_source,external_guest_key,full_name,email,phone',
        'Demo Concert,LOCAL_DEMO,VIP-001,Demo Guest One,one@example.test,+84900000001',
        'Demo Concert,LOCAL_DEMO,,Demo Guest Two,two@example.test,+84900000002',
      ]),
      'utf8',
    );
    const state = createState(sourcePath);
    const worker = createWorker(state);

    await worker.processImport('import-1');
    const retry = await worker.processImport('import-1');

    assert.equal(retry.status, ImportStatus.COMPLETED);
    assert.equal(retry.acceptedRows, 2);
    assert.equal(state.guests.length, 2);
  });
});

test('worker skips processing when another worker already claimed the import', async () => {
  await withTempCsv(async (sourcePath) => {
    await writeFile(
      sourcePath,
      csv([
        'concert_title,sponsor_source,external_guest_key,full_name,email,phone',
        'Demo Concert,LOCAL_DEMO,VIP-001,Demo Guest One,one@example.test,+84900000001',
      ]),
      'utf8',
    );
    const state = createState(sourcePath);
    state.claimConflictStatus = ImportStatus.PROCESSING;
    state.errors.push({
      id: 'existing-error',
      importId: 'import-1',
      type: ImportErrorType.ROW,
      rowNumber: 2,
      field: 'email',
      code: 'EXISTING_ERROR',
      message: 'Existing error',
      rawRow: null,
      metadata: null,
      createdAt: new Date('2026-06-15T12:00:00.000Z'),
    });
    const worker = createWorker(state);

    const result = await worker.processImport('import-1');

    assert.equal(result.status, ImportStatus.PROCESSING);
    assert.equal(state.guests.length, 0);
    assert.equal(state.errors.length, 1);
    assert.deepEqual(state.auditLogs, []);
  });
});

test('worker marks partial failures retryable and recovers without duplicate guests', async () => {
  const previousBatchSize = process.env.VIP_IMPORT_BATCH_SIZE;
  process.env.VIP_IMPORT_BATCH_SIZE = '1';

  try {
    await withTempCsv(async (sourcePath) => {
      await writeFile(
        sourcePath,
        csv([
          'concert_title,sponsor_source,external_guest_key,full_name,email,phone',
          'Demo Concert,LOCAL_DEMO,VIP-001,Demo Guest One,one@example.test,+84900000001',
          'Demo Concert,LOCAL_DEMO,VIP-002,Demo Guest Two,two@example.test,+84900000002',
        ]),
        'utf8',
      );
      const state = createState(sourcePath);
      state.failOnGuestCreateAttempt = 2;
      const worker = createWorker(state);

      const failed = await worker.processImport('import-1');
      assert.equal(failed.status, ImportStatus.RETRYABLE_FAILED);
      assert.equal(state.guests.length, 1);

      state.failOnGuestCreateAttempt = undefined;
      const recovered = await worker.processImport('import-1');

      assert.equal(recovered.status, ImportStatus.COMPLETED);
      assert.equal(recovered.acceptedRows, 2);
      assert.equal(state.guests.length, 2);
    });
  } finally {
    if (previousBatchSize === undefined) {
      delete process.env.VIP_IMPORT_BATCH_SIZE;
    } else {
      process.env.VIP_IMPORT_BATCH_SIZE = previousBatchSize;
    }
  }
});

function createWorker(state: TestState): VipImportWorkerService {
  return new VipImportWorkerService(createPrismaMock(state) as unknown as PrismaService);
}

function createState(sourcePath: string): TestState {
  const now = new Date('2026-06-15T12:00:00.000Z');

  return {
    imports: [
      {
        id: 'import-1',
        concertId: 'concert-1',
        sourceName: 'LOCAL_DEMO',
        fileName: 'vip.csv',
        sourcePath,
        sourceFingerprint: 'fingerprint',
        status: ImportStatus.QUEUED,
        totalRows: 0,
        acceptedRows: 0,
        rejectedRows: 0,
        duplicateRows: 0,
        failureCode: null,
        failureMessage: null,
        queuedAt: now,
        startedAt: null,
        importedAt: null,
        createdAt: now,
        updatedAt: now,
      },
    ],
    guests: [],
    errors: [],
    auditLogs: [],
    guestCreateAttempts: 0,
  };
}

function createPrismaMock(state: TestState) {
  const tx = {
    vipGuestImport: {
      findMany: async ({ where, take }: FindManyImportArgs = {}) => {
        const statuses = where?.status?.in;
        const imports = statuses
          ? state.imports.filter((importRecord) => statuses.includes(importRecord.status))
          : state.imports;

        return typeof take === 'number' ? imports.slice(0, take) : imports;
      },
      findUnique: async ({ where }: { where: { id: string } }) =>
        state.imports.find((importRecord) => importRecord.id === where.id) ?? null,
      updateMany: async ({ where, data }: UpdateManyImportArgs) => {
        const importRecord = state.imports.find(
          (candidate) => !where.id || candidate.id === where.id,
        );

        if (!importRecord) {
          return { count: 0 };
        }

        if (state.claimConflictStatus && data.status === ImportStatus.PROCESSING) {
          Object.assign(importRecord, {
            status: state.claimConflictStatus,
            updatedAt: new Date(),
          });
          state.claimConflictStatus = undefined;

          return { count: 0 };
        }

        if (where.status?.in && !where.status.in.includes(importRecord.status)) {
          return { count: 0 };
        }

        Object.assign(importRecord, data, { updatedAt: new Date() });

        return { count: 1 };
      },
      update: async ({ where, data }: { where: { id: string }; data: Partial<TestImport> }) => {
        const importRecord = state.imports.find((candidate) => candidate.id === where.id);
        assert.ok(importRecord);
        Object.assign(importRecord, data, { updatedAt: new Date() });
        return importRecord;
      },
    },
    vipGuestImportError: {
      deleteMany: async ({ where }: { where: { importId: string } }) => {
        state.errors = state.errors.filter((error) => error.importId !== where.importId);
        return { count: 0 };
      },
      create: async ({ data }: { data: Partial<TestError> }) => {
        const error: TestError = {
          id: `error-${state.errors.length + 1}`,
          importId: data.importId ?? 'import-1',
          type: data.type ?? ImportErrorType.ROW,
          rowNumber: data.rowNumber ?? null,
          field: data.field ?? null,
          code: data.code ?? 'ERROR',
          message: data.message ?? 'Error',
          rawRow: data.rawRow,
          metadata: data.metadata,
          createdAt: new Date(),
        };

        state.errors.push(error);
        return error;
      },
    },
    vipGuest: {
      findFirst: async ({
        where,
      }: {
        where: {
          concertId: string;
          sponsorSource: string;
          externalGuestKey?: string | null;
          normalizedIdentityKey?: string | null;
        };
      }) =>
        state.guests.find(
          (guest) =>
            guest.concertId === where.concertId &&
            guest.sponsorSource === where.sponsorSource &&
            (where.externalGuestKey
              ? guest.externalGuestKey === where.externalGuestKey
              : guest.normalizedIdentityKey === where.normalizedIdentityKey),
        ) ?? null,
      create: async ({ data }: { data: Partial<TestGuest> }) => {
        state.guestCreateAttempts += 1;

        if (state.failOnGuestCreateAttempt === state.guestCreateAttempts) {
          throw new Error('Simulated database write failure');
        }

        if (state.concurrentGuestCreateConflict) {
          const guest = createGuest({
            ...data,
            ...state.concurrentGuestCreateConflict,
            id:
              state.concurrentGuestCreateConflict.id ??
              `guest-${state.guests.length + 1}`,
          });

          state.guests.push(guest);
          state.concurrentGuestCreateConflict = undefined;

          throw new Prisma.PrismaClientKnownRequestError(
            'Unique constraint failed on VIP guest identity',
            {
              code: 'P2002',
              clientVersion: 'test',
              meta: {
                target: ['concertId', 'sponsorSource', 'externalGuestKey'],
              },
            },
          );
        }

        const guest = createGuest({
          ...data,
          id: `guest-${state.guests.length + 1}`,
        });

        state.guests.push(guest);
        return guest;
      },
      update: async ({ where, data }: { where: { id: string }; data: Partial<TestGuest> }) => {
        const guest = state.guests.find((candidate) => candidate.id === where.id);
        assert.ok(guest);
        Object.assign(guest, data, { updatedAt: new Date() });
        return guest;
      },
    },
    auditLog: {
      create: async ({ data }: { data: { action: string; importId: string | null; metadata: unknown } }) => {
        state.auditLogs.push(data);
        return data;
      },
    },
  };

  return {
    ...tx,
    $transaction: async (callback: (transaction: typeof tx) => Promise<unknown>) => callback(tx),
  };
}

function createGuest(input: Partial<TestGuest>): TestGuest {
  const now = new Date('2026-06-15T12:00:00.000Z');

  return {
    id: input.id ?? 'guest-1',
    importId: input.importId ?? 'import-1',
    concertId: input.concertId ?? 'concert-1',
    sponsorSource: input.sponsorSource ?? 'LOCAL_DEMO',
    externalGuestKey: 'externalGuestKey' in input ? input.externalGuestKey ?? null : 'VIP-EXISTING',
    qrHash: input.qrHash ?? 'qr-existing',
    fullName: input.fullName ?? 'Existing Guest',
    email: input.email ?? 'existing@example.test',
    phone: input.phone ?? null,
    sponsorCompany: input.sponsorCompany ?? null,
    invitedBy: input.invitedBy ?? null,
    guestType: input.guestType ?? null,
    allowedGate: input.allowedGate ?? null,
    notes: input.notes ?? null,
    normalizedFullName: input.normalizedFullName ?? 'existing guest',
    normalizedEmail: input.normalizedEmail ?? 'existing@example.test',
    normalizedPhone: input.normalizedPhone ?? null,
    normalizedIdentityKey: input.normalizedIdentityKey ?? null,
    sourceRowNumber: input.sourceRowNumber ?? 2,
    status: input.status ?? VipGuestStatus.ACTIVE,
    checkedInAt: input.checkedInAt ?? null,
    importedAt: input.importedAt ?? now,
    createdAt: input.createdAt ?? now,
    updatedAt: input.updatedAt ?? now,
  };
}

async function withTempCsv(callback: (sourcePath: string) => Promise<void>): Promise<void> {
  const sourceDir = await mkdtemp(join(tmpdir(), 'ticketbox-vip-worker-'));
  const sourcePath = join(sourceDir, 'vip.csv');

  try {
    await callback(sourcePath);
  } finally {
    await rm(sourceDir, { recursive: true, force: true });
  }
}

function csv(lines: string[]): string {
  return lines.join('\n');
}
