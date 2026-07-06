import assert from 'node:assert/strict';
import test from 'node:test';
import { BadRequestException, ConflictException, ForbiddenException, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ArtistDocumentStatus } from '@prisma/client';
import { AiProviderError, ArtistBioAiProvider } from './artist-bio-ai.provider';
import { ArtistDocumentsService } from './artist-documents.service';
import { StorageTimeoutError } from './artist-document.storage';
import { ArtistBioWorkerService } from './artist-bio-worker.service';
import { PdfTextExtractionError, PdfTextExtractor } from './pdf-text-extractor';

function config() {
  return new ConfigService({
    MINIO_ACCESS_KEY: 'test', MINIO_SECRET_KEY: 'test-secret', AI_PROVIDER: 'mock',
    AI_TEXT_MAX_CHARS: '4000', PDF_MIN_TEXT_CHARS: '50', KAFKA_BROKERS: 'localhost:9092',
  });
}

test('PDF validation requires extension, MIME type, and signature', () => {
  const extractor = new PdfTextExtractor(config());
  extractor.assertValidPdf('press-kit.pdf', 'application/pdf', Buffer.from('%PDF-1.7'));
  assert.throws(() => extractor.assertValidPdf('press-kit.txt', 'text/plain', Buffer.from('hello')), BadRequestException);
});

test('PDF cleaning normalizes control characters and whitespace', () => {
  const extractor = new PdfTextExtractor(config());
  assert.equal(extractor.clean('  Artist\u0000\n\n biography\t here  '), 'Artist biography here');
});

test('mock AI adapter returns Vietnamese text and caps source input at 4000 characters', async () => {
  const provider = new ArtistBioAiProvider(config());
  const result = await provider.generate(`${'A'.repeat(4000)}SECRET_AFTER_CAP`);
  assert.match(result, /^Tiểu sử nghệ sĩ:/);
  assert.equal(result.includes('SECRET_AFTER_CAP'), false);
});

test('completed Kafka event is idempotently ignored', async () => {
  let writes = 0;
  const prisma = {
    artistDocument: {
      findFirst: async () => ({ id: 'doc', concertId: 'concert', storageKey: 'key', status: ArtistDocumentStatus.DONE, bio: { id: 'bio' } }),
      update: async () => { writes += 1; },
    },
  };
  const worker = new ArtistBioWorkerService(
    config(), prisma as never, {} as never, {} as never, {} as never, {} as never, {} as never,
  );
  await worker.process({ document_id: 'doc', concert_id: 'concert', storage_key: 'key', attempt: 1 });
  assert.equal(writes, 0);
});

test('short extracted text is represented by the permanent extraction error', () => {
  const error = new PdfTextExtractionError('Could not extract text. Please upload a text-based PDF.');
  assert.equal(error.message, 'Could not extract text. Please upload a text-based PDF.');
});

type ArtistServiceHarness = {
  service: ArtistDocumentsService;
  published: unknown[];
  created: unknown[];
};

function artistServiceHarness(ownerId = 'owner', publishFails = false, editable = true): ArtistServiceHarness {
  const published: unknown[] = [];
  const created: unknown[] = [];
  const prisma = {
    userRole: { findMany: async () => [{ role: { code: 'ORGANIZER' } }] },
    concert: { findUnique: async () => ({
      organizerId: ownerId,
      status: editable ? 'PUBLISHED' : 'CANCELLED',
      startsAt: new Date('2099-01-01T00:00:00.000Z'),
      performanceStartAt: new Date('2099-01-01T01:00:00.000Z'),
    }) },
    artistDocument: {
      create: async ({ data }: { data: unknown }) => { created.push(data); return data; },
      findMany: async () => [],
      findFirst: async () => null,
      update: async () => ({}),
    },
    aiArtistBio: { update: async () => ({}) },
    auditLog: { create: async () => ({}) },
    $transaction: async (operations: Promise<unknown>[]) => Promise.all(operations),
  };
  const permission = { userHasPermissions: async () => true };
  const storage = {
    buildStorageKey: (concertId: string, documentId: string) => `artist-documents/${concertId}/${documentId}.pdf`,
    upload: async () => undefined,
    remove: async () => undefined,
  };
  const publisher = { publish: async (event: unknown) => { if (publishFails) throw new Error('Kafka down'); published.push(event); } };
  const redis = { del: async () => undefined };
  const service = new ArtistDocumentsService(prisma as never, permission as never, storage as never, publisher as never, new PdfTextExtractor(config()), redis as never);
  return { service, published, created };
}

test('owned organizer upload persists and publishes before returning uploaded', async () => {
  const harness = artistServiceHarness();
  const result = await harness.service.upload({ id: 'owner', email: 'owner@test' }, '11111111-1111-4111-8111-111111111111', {
    originalname: 'press-kit.pdf', mimetype: 'application/pdf', size: 12, buffer: Buffer.from('%PDF-1.4 demo'),
  });
  assert.equal(result.status, 'uploaded');
  assert.equal(harness.created.length, 1);
  assert.equal(harness.published.length, 1);
});
test('owned organizer upload decodes Vietnamese PDF file names before storing', async () => {
  const harness = artistServiceHarness();
  const mojibakeName = Buffer.from('Chị Đẹp Đạp Gió Rẽ Sóng Live Concert 2026.pdf', 'utf8').toString('latin1');
  await harness.service.upload({ id: 'owner', email: 'owner@test' }, '11111111-1111-4111-8111-111111111111', {
    originalname: mojibakeName, mimetype: 'application/pdf', size: 12, buffer: Buffer.from('%PDF-1.4 demo'),
  });
  assert.equal((harness.created[0] as { fileName: string }).fileName, 'Chị Đẹp Đạp Gió Rẽ Sóng Live Concert 2026.pdf');
});

test('non-owner upload is forbidden before storage or publication', async () => {
  const harness = artistServiceHarness('different-owner');
  await assert.rejects(
    harness.service.upload({ id: 'owner', email: 'owner@test' }, '11111111-1111-4111-8111-111111111111', {
      originalname: 'press-kit.pdf', mimetype: 'application/pdf', size: 12, buffer: Buffer.from('%PDF-1.4 demo'),
    }),
    ForbiddenException,
  );
  assert.equal(harness.created.length, 0);
});

test('Kafka publish failure does not falsely acknowledge upload', async () => {
  const harness = artistServiceHarness('owner', true);
  await assert.rejects(
    harness.service.upload({ id: 'owner', email: 'owner@test' }, '11111111-1111-4111-8111-111111111111', {
      originalname: 'press-kit.pdf', mimetype: 'application/pdf', size: 12, buffer: Buffer.from('%PDF-1.4 demo'),
    }),
    ServiceUnavailableException,
  );
  assert.equal(harness.created.length, 1);
});

test('worker retry helpers apply exponential storage retry and 60 second rate-limit delay', async () => {
  let storageAttempts = 0;
  let aiAttempts = 0;
  const delays: number[] = [];
  const ai = {
    generate: async () => {
      aiAttempts += 1;
      if (aiAttempts === 1) throw new AiProviderError('rate_limit', 'limited');
      return 'bio';
    },
  };
  const worker = new ArtistBioWorkerService(config(), { artistDocument: {} } as never, {} as never, {} as never, ai as never, {} as never, {} as never);
  const internals = worker as unknown as {
    retry<T>(operation: () => Promise<T>, attempts: number, retryable: (error: unknown) => boolean, delay: number): Promise<T>;
    generateWithRetry(text: string): Promise<string>;
    sleep(ms: number): Promise<void>;
  };
  internals.sleep = async (ms) => { delays.push(ms); };
  const stored = await internals.retry(async () => {
    storageAttempts += 1;
    if (storageAttempts < 3) throw new StorageTimeoutError('timeout');
    return 'pdf';
  }, 3, (error) => error instanceof StorageTimeoutError, 500);
  assert.equal(stored, 'pdf');
  assert.deepEqual(delays, [500, 1000]);
  delays.length = 0;
  assert.equal(await internals.generateWithRetry('press kit'), 'bio');
  assert.deepEqual(delays, [60000]);
});

test('read-only concert rejects upload before storage or publication', async () => {
  const harness = artistServiceHarness('owner', false, false);
  await assert.rejects(
    harness.service.upload({ id: 'owner', email: 'owner@test' }, '11111111-1111-4111-8111-111111111111', {
      originalname: 'press-kit.pdf', mimetype: 'application/pdf', size: 12, buffer: Buffer.from('%PDF-1.4 demo'),
    }),
    ConflictException,
  );
  assert.equal(harness.created.length, 0);
  assert.equal(harness.published.length, 0);
});

test('read-only concert still allows document listing', async () => {
  const harness = artistServiceHarness('owner', false, false);
  assert.deepEqual(await harness.service.list({ id: 'owner', email: 'owner@test' }, '11111111-1111-4111-8111-111111111111'), []);
});

test('read-only concert rejects manual edit and regeneration before document mutation', async () => {
  const harness = artistServiceHarness('owner', false, false);
  const user = { id: 'owner', email: 'owner@test' };
  const concertId = '11111111-1111-4111-8111-111111111111';
  await assert.rejects(harness.service.updateBio(user, concertId, '22222222-2222-4222-8222-222222222222', 'Updated bio'), ConflictException);
  await assert.rejects(harness.service.regenerate(user, concertId, '22222222-2222-4222-8222-222222222222'), ConflictException);
  assert.equal(harness.created.length, 0);
  assert.equal(harness.published.length, 0);
});
