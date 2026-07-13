import * as assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { test } from 'node:test';
import { ImportStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { VipImportJobsPublisher } from './vip-import-jobs.publisher';
import { VipImportSchedulerService } from './vip-import-scheduler.service';

type TestState = {
  concerts: { id: string; title: string }[];
  imports: {
    id: string;
    concertId: string;
    sourceName: string;
    fileName: string;
    sourcePath: string | null;
    sourceFingerprint: string;
    status: ImportStatus;
    failureCode: string | null;
    failureMessage: string | null;
    queuedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  }[];
  auditLogs: { action: string; importId: string | null }[];
};

type PrismaMockOptions = {
  beforeImportCreate?: (data: Partial<TestState['imports'][0]>) => Promise<void> | void;
};

test('scheduler detects a new sponsor CSV and queues one import job', async () => {
  await withTempCsvDir(async (sourceDir) => {
    const state = createState();
    const publishedJobs: string[] = [];
    const scheduler = createScheduler(state, {
      publishImportRequested: async (job) => {
        publishedJobs.push(job.importId);
      },
    });

    await writeVipCsv(sourceDir, 'valid.csv');

    const result = await scheduler.scanScheduledImports(sourceDir);

    assert.equal(result.detected, 1);
    assert.equal(result.queued, 1);
    assert.equal(result.failedToEnqueue, 0);
    assert.equal(state.imports.length, 1);
    assert.equal(state.imports[0].status, ImportStatus.QUEUED);
    assert.equal(publishedJobs.length, 1);
    assert.deepEqual(
      state.auditLogs.map((entry) => entry.action),
      ['vip_import.detected', 'vip_import.queued'],
    );
  });
});

test('scheduler repeated detection is idempotent by concert, source, and fingerprint', async () => {
  await withTempCsvDir(async (sourceDir) => {
    const state = createState();
    const scheduler = createScheduler(state);

    await writeVipCsv(sourceDir, 'valid.csv');

    const first = await scheduler.scanScheduledImports(sourceDir);
    const second = await scheduler.scanScheduledImports(sourceDir);

    assert.equal(first.queued, 1);
    assert.equal(second.queued, 0);
    assert.equal(second.skipped, 1);
    assert.equal(state.imports.length, 1);
  });
});

test('scheduler reuses a concurrently created import when create hits a unique constraint', async () => {
  await withTempCsvDir(async (sourceDir) => {
    const state = createState();
    const concurrentImportId = '00000000-0000-4000-8000-000000000099';
    const publishedJobs: string[] = [];
    let insertedConcurrentImport = false;
    const scheduler = createScheduler(
      state,
      {
        publishImportRequested: async (job) => {
          publishedJobs.push(job.importId);
        },
      },
      {
        beforeImportCreate: (data) => {
          if (insertedConcurrentImport) {
            return;
          }

          insertedConcurrentImport = true;
          const now = new Date();
          state.imports.push({
            id: concurrentImportId,
            concertId: data.concertId ?? state.concerts[0].id,
            sourceName: data.sourceName ?? 'SPONSOR_CSV',
            fileName: data.fileName ?? 'vip.csv',
            sourcePath: data.sourcePath ?? null,
            sourceFingerprint: data.sourceFingerprint ?? 'fingerprint',
            status: ImportStatus.DETECTED,
            failureCode: null,
            failureMessage: null,
            queuedAt: null,
            createdAt: now,
            updatedAt: now,
          });
        },
      },
    );

    await writeVipCsv(sourceDir, 'valid.csv');

    const result = await scheduler.scanScheduledImports(sourceDir);

    assert.equal(result.detected, 1);
    assert.equal(result.queued, 1);
    assert.equal(state.imports.length, 1);
    assert.deepEqual(publishedJobs, [concurrentImportId]);
    assert.deepEqual(
      state.auditLogs.map((entry) => entry.action),
      ['vip_import.queued'],
    );
  });
});

test('scheduler preserves retry eligibility when queue enqueue is unavailable', async () => {
  await withTempCsvDir(async (sourceDir) => {
    const state = createState();
    const scheduler = createScheduler(state, {
      publishImportRequested: async () => {
        throw new Error('VIP import queue unavailable');
      },
    });

    await writeVipCsv(sourceDir, 'valid.csv');

    const result = await scheduler.scanScheduledImports(sourceDir);

    assert.equal(result.detected, 1);
    assert.equal(result.queued, 0);
    assert.equal(result.failedToEnqueue, 1);
    assert.equal(state.imports[0].status, ImportStatus.FAILED_TO_ENQUEUE);
    assert.equal(state.imports[0].failureCode, 'QUEUE_ENQUEUE_FAILED');
  });
});

test('scheduler skips CSV files that exceed the configured max file size', async () => {
  await withEnv('VIP_IMPORT_MAX_FILE_SIZE_BYTES', '32', async () => {
    await withTempCsvDir(async (sourceDir) => {
      const state = createState();
      const publishedJobs: string[] = [];
      const scheduler = createScheduler(state, {
        publishImportRequested: async (job) => {
          publishedJobs.push(job.importId);
        },
      });

      await writeVipCsv(sourceDir, 'oversized.csv');

      const result = await scheduler.scanScheduledImports(sourceDir);

      assert.equal(result.detected, 0);
      assert.equal(result.queued, 0);
      assert.equal(result.skipped, 1);
      assert.equal(state.imports.length, 0);
      assert.equal(publishedJobs.length, 0);
    });
  });
});

test('scheduler skips CSV files that exceed the configured max row count', async () => {
  await withEnv('VIP_IMPORT_MAX_ROWS', '1', async () => {
    await withTempCsvDir(async (sourceDir) => {
      const state = createState();
      const publishedJobs: string[] = [];
      const scheduler = createScheduler(state, {
        publishImportRequested: async (job) => {
          publishedJobs.push(job.importId);
        },
      });

      await writeVipCsv(sourceDir, 'too-many-rows.csv', [
        'Demo Concert,LOCAL_DEMO,VIP-001,Demo Guest One,one@example.test,+84900000001',
        'Demo Concert,LOCAL_DEMO,VIP-002,Demo Guest Two,two@example.test,+84900000002',
      ]);

      const result = await scheduler.scanScheduledImports(sourceDir);

      assert.equal(result.detected, 0);
      assert.equal(result.queued, 0);
      assert.equal(result.skipped, 1);
      assert.equal(state.imports.length, 0);
      assert.equal(publishedJobs.length, 0);
    });
  });
});

test('scheduler skips alternate-delimited CSV files instead of queueing a misparsed import', async () => {
  await withTempCsvDir(async (sourceDir) => {
    const state = createState();
    const publishedJobs: string[] = [];
    const scheduler = createScheduler(state, {
      publishImportRequested: async (job) => {
        publishedJobs.push(job.importId);
      },
    });

    await writeRawCsv(sourceDir, 'semicolon.csv', [
      'concert_title;sponsor_source;external_guest_key;full_name;email;phone',
      'Demo Concert;LOCAL_DEMO;VIP-001;Demo Guest;demo@example.test;+84900000001',
    ]);

    const result = await scheduler.scanScheduledImports(sourceDir);

    assert.equal(result.detected, 0);
    assert.equal(result.queued, 0);
    assert.equal(result.skipped, 1);
    assert.equal(state.imports.length, 0);
    assert.equal(publishedJobs.length, 0);
  });
});

test('scheduler skips CSV files that are not valid UTF-8', async () => {
  await withTempCsvDir(async (sourceDir) => {
    const state = createState();
    const publishedJobs: string[] = [];
    const scheduler = createScheduler(state, {
      publishImportRequested: async (job) => {
        publishedJobs.push(job.importId);
      },
    });

    await writeRawBytes(sourceDir, 'invalid-encoding.csv', invalidUtf8VipCsv());

    const result = await scheduler.scanScheduledImports(sourceDir);

    assert.equal(result.detected, 0);
    assert.equal(result.queued, 0);
    assert.equal(result.skipped, 1);
    assert.equal(state.imports.length, 0);
    assert.equal(publishedJobs.length, 0);
  });
});

test('scheduler skips structurally malformed CSV files instead of queueing them', async () => {
  await withTempCsvDir(async (sourceDir) => {
    const state = createState();
    const publishedJobs: string[] = [];
    const scheduler = createScheduler(state, {
      publishImportRequested: async (job) => {
        publishedJobs.push(job.importId);
      },
    });

    await writeRawCsv(sourceDir, 'malformed.csv', [
      'concert_title,sponsor_source,external_guest_key,full_name,email,phone',
      'Demo Concert,LOCAL_DEMO,VIP-001,"Broken Guest,demo@example.test,+84900000001',
    ]);

    const result = await scheduler.scanScheduledImports(sourceDir);

    assert.equal(result.detected, 0);
    assert.equal(result.queued, 0);
    assert.equal(result.skipped, 1);
    assert.equal(state.imports.length, 0);
    assert.equal(publishedJobs.length, 0);
  });
});

function createState(): TestState {
  return {
    concerts: [{ id: '00000000-0000-4000-8000-000000000001', title: 'Demo Concert' }],
    imports: [],
    auditLogs: [],
  };
}

function createScheduler(
  state: TestState,
  publisher: Partial<VipImportJobsPublisher> = {
    publishImportRequested: async () => undefined,
  },
  options?: PrismaMockOptions,
): VipImportSchedulerService {
  return new VipImportSchedulerService(
    createPrismaMock(state, options) as unknown as PrismaService,
    publisher as VipImportJobsPublisher,
  );
}

function createPrismaMock(state: TestState, options?: PrismaMockOptions) {
  return {
    concert: {
      findUnique: async ({ where }: { where: { id?: string } }) =>
        state.concerts.find((concert) => concert.id === where.id) ?? null,
      findFirst: async ({ where }: { where: { title?: string } }) =>
        state.concerts.find((concert) => concert.title === where.title) ?? null,
    },
    vipGuestImport: {
      findFirst: async ({
        where,
      }: {
        where: {
          concertId: string;
          sourceName: string;
          sourceFingerprint: string;
        };
      }) =>
        state.imports.find(
          (importRecord) =>
            importRecord.concertId === where.concertId &&
            importRecord.sourceName === where.sourceName &&
            importRecord.sourceFingerprint === where.sourceFingerprint,
        ) ?? null,
      create: async ({ data }: { data: Partial<TestState['imports'][0]> }) => {
        await options?.beforeImportCreate?.(data);

        if (
          state.imports.some(
            (importRecord) =>
              importRecord.concertId === data.concertId &&
              importRecord.sourceName === data.sourceName &&
              importRecord.sourceFingerprint === data.sourceFingerprint,
          )
        ) {
          throw new Prisma.PrismaClientKnownRequestError(
            'Unique constraint failed on import identity',
            {
              code: 'P2002',
              clientVersion: 'test',
              meta: {
                target: ['concertId', 'sourceName', 'sourceFingerprint'],
              },
            },
          );
        }

        const now = new Date();
        const importRecord = {
          id: `00000000-0000-4000-8000-00000000000${state.imports.length + 1}`,
          concertId: data.concertId ?? state.concerts[0].id,
          sourceName: data.sourceName ?? 'SPONSOR_CSV',
          fileName: data.fileName ?? 'vip.csv',
          sourcePath: data.sourcePath ?? null,
          sourceFingerprint: data.sourceFingerprint ?? 'fingerprint',
          status: data.status ?? ImportStatus.DETECTED,
          failureCode: null,
          failureMessage: null,
          queuedAt: null,
          createdAt: now,
          updatedAt: now,
        };

        state.imports.push(importRecord);
        return importRecord;
      },
      update: async ({
        where,
        data,
      }: {
        where: { id: string };
        data: Partial<TestState['imports'][0]>;
      }) => {
        const importRecord = state.imports.find((candidate) => candidate.id === where.id);
        assert.ok(importRecord);
        Object.assign(importRecord, data, { updatedAt: new Date() });
        return importRecord;
      },
    },
    auditLog: {
      create: async ({ data }: { data: { action: string; importId: string | null } }) => {
        state.auditLogs.push(data);
        return data;
      },
    },
  };
}

async function withTempCsvDir(callback: (sourceDir: string) => Promise<void>): Promise<void> {
  const sourceDir = await mkdtemp(join(tmpdir(), 'ticketbox-vip-import-'));

  try {
    await callback(sourceDir);
  } finally {
    await rm(sourceDir, { recursive: true, force: true });
  }
}

async function writeVipCsv(
  sourceDir: string,
  fileName: string,
  rows = ['Demo Concert,LOCAL_DEMO,VIP-001,Demo Guest,demo@example.test,+84900000001'],
): Promise<void> {
  await writeFile(
    join(sourceDir, fileName),
    [
      'concert_title,sponsor_source,external_guest_key,full_name,email,phone',
      ...rows,
    ].join('\n'),
    'utf8',
  );
}

async function writeRawCsv(sourceDir: string, fileName: string, rows: string[]): Promise<void> {
  await writeFile(join(sourceDir, fileName), rows.join('\n'), 'utf8');
}

async function writeRawBytes(
  sourceDir: string,
  fileName: string,
  content: Buffer,
): Promise<void> {
  await writeFile(join(sourceDir, fileName), content);
}

function invalidUtf8VipCsv(): Buffer {
  return Buffer.concat([
    Buffer.from(
      [
        'concert_title,sponsor_source,external_guest_key,full_name,email,phone',
        'Demo Concert,LOCAL_DEMO,VIP-001,Nguy',
      ].join('\n'),
      'utf8',
    ),
    Buffer.from([0xea]),
    Buffer.from('n Van A,nguyen@example.test,+84900000001', 'utf8'),
  ]);
}

async function withEnv(name: string, value: string, callback: () => Promise<void>): Promise<void> {
  const previous = process.env[name];
  process.env[name] = value;

  try {
    await callback();
  } finally {
    if (previous === undefined) {
      delete process.env[name];
    } else {
      process.env[name] = previous;
    }
  }
}
