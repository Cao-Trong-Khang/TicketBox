import * as assert from 'node:assert/strict';
import { test } from 'node:test';
import { BadRequestException, ConflictException, ForbiddenException, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ArtistDocumentStatus } from '@prisma/client';
import { getArtistBioConfig } from '../../config/app.config';
import { AiProviderError, ArtistBioAiProvider } from './artist-bio-ai.provider';
import { ArtistDocumentsService } from './artist-documents.service';
import { StorageTimeoutError } from './artist-document.storage';
import { ArtistBioWorkerService } from './artist-bio-worker.service';
import { ArtistBioPreviewService } from './artist-bio-preview.service';
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

test('Gemini adapter rewrites an English response before returning it', async () => {
  const originalFetch = global.fetch;
  const requests: Array<{ body?: string }> = [];
  const responses = [
    'The band is based in Vietnam and their music combines indie rock with dream pop performances.',
    'Ban nhạc hoạt động tại Việt Nam và kết hợp indie rock với dream pop trong các màn biểu diễn giàu cảm xúc.',
  ];
  global.fetch = async (_input, init) => {
    requests.push({ body: init?.body as string | undefined });
    const text = responses.shift();
    return { ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text }] } }] }) } as Response;
  };

  try {
    const provider = new ArtistBioAiProvider(new ConfigService({
      AI_PROVIDER: 'gemini', AI_MODEL: 'gemini-2.5-flash', GEMINI_API_KEY: 'test-key',
    }));
    const result = await provider.generate('English press kit source');
    assert.match(result, /^Ban nhạc/);
    assert.equal(requests.length, 2);
    assert.match(requests[1].body ?? '', /viết lại toàn bộ nội dung/);
  } finally {
    global.fetch = originalFetch;
  }
});

test('Gemini adapter forces a substantially different Vietnamese regeneration', async () => {
  const originalFetch = global.fetch;
  const requests: Array<{ body?: string }> = [];
  const previous = 'Ban nhạc hoạt động tại Thành phố Hồ Chí Minh và mang đến những màn biểu diễn giàu cảm xúc cho khán giả.';
  const responses = [
    previous,
    'Xuất phát từ Thành phố Hồ Chí Minh, nhóm chinh phục người nghe bằng nguồn năng lượng sân khấu mạnh mẽ và cách kể chuyện âm nhạc gần gũi.',
  ];
  global.fetch = async (_input, init) => {
    requests.push({ body: init?.body as string | undefined });
    const text = responses.shift();
    return { ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text }] } }] }) } as Response;
  };

  try {
    const provider = new ArtistBioAiProvider(new ConfigService({
      AI_PROVIDER: 'gemini', AI_MODEL: 'gemini-2.5-flash', GEMINI_API_KEY: 'test-key',
    }));
    const result = await provider.generate('Press kit source', previous);
    assert.match(result, /^Xuất phát/);
    assert.equal(requests.length, 2);
    assert.match(requests[0].body ?? '', /BẢN TRƯỚC CẦN TRÁNH LẶP LẠI/);
    assert.match(requests[1].body ?? '', /vẫn quá giống bản trước/);
  } finally {
    global.fetch = originalFetch;
  }
});

test('preview extracts the PDF and returns an AI biography without creating a concert document', async () => {
  let extracted = 0;
  let generated = 0;
  let previousBioSeen: string | undefined;
  const extractor = {
    assertValidPdf: () => undefined,
    extract: async () => { extracted += 1; return 'Press kit content long enough for preview'; },
  };
  const ai = {
    generate: async (_text: string, previousBio?: string) => {
      generated += 1;
      previousBioSeen = previousBio;
      return 'Generated preview biography';
    },
  };
  const service = new ArtistBioPreviewService(extractor as never, ai as never);

  const result = await service.generate({
    originalname: 'press-kit.pdf', mimetype: 'application/pdf', size: 12, buffer: Buffer.from('%PDF-1.4 demo'),
  }, 'Previous preview biography');

  assert.deepEqual(result, { generated_bio: 'Generated preview biography' });
  assert.equal(extracted, 1);
  assert.equal(generated, 1);
  assert.equal(previousBioSeen, 'Previous preview biography');
});

test('duplicate Kafka event is ignored when another worker already claimed the document', async () => {
  let storageDownloads = 0;
  let bioWrites = 0;
  const prisma = {
    artistDocument: {
      findFirst: async () => ({
        id: 'doc',
        concertId: 'concert',
        storageKey: 'key',
        status: ArtistDocumentStatus.UPLOADED,
        bio: null,
      }),
      updateMany: async () => ({ count: 0 }),
    },
    aiArtistBio: {
      upsert: async () => { bioWrites += 1; },
    },
  };
  const storage = {
    download: async () => {
      storageDownloads += 1;
      return Buffer.from('pdf');
    },
  };
  const worker = new ArtistBioWorkerService(
    config(), prisma as never, storage as never, {} as never, {} as never, {} as never, {} as never,
  );

  await worker.process({ document_id: 'doc', concert_id: 'concert', storage_key: 'key', attempt: 1 });

  assert.equal(storageDownloads, 0);
  assert.equal(bioWrites, 0);
});

test('short extracted text is represented by the permanent extraction error', () => {
  const error = new PdfTextExtractionError('Could not extract text. Please upload a text-based PDF.');
  assert.equal(error.message, 'Could not extract text. Please upload a text-based PDF.');
});

type ArtistServiceHarness = {
  service: ArtistDocumentsService;
  published: unknown[];
  created: unknown[];
  createdBios: unknown[];
  deleted: string[];
  removedStorageKeys: string[];
  uploadedStorageKeys: string[];
  generatedInputs: Array<{ text: string; previousBio?: string }>;
};

function artistServiceHarness(
  ownerId = 'owner',
  publishFails = false,
  editable = true,
  existingDocument: Record<string, unknown> | null = null,
  remainingStorageReferences = 0,
  processingMode: 'worker' | 'inline' = 'worker',
): ArtistServiceHarness {
  const published: unknown[] = [];
  const created: unknown[] = [];
  const createdBios: unknown[] = [];
  const deleted: string[] = [];
  const removedStorageKeys: string[] = [];
  const uploadedStorageKeys: string[] = [];
  const generatedInputs: Array<{ text: string; previousBio?: string }> = [];
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
      findFirst: async () => existingDocument,
      update: async () => ({}),
      delete: async ({ where }: { where: { id: string } }) => { deleted.push(where.id); return existingDocument; },
      count: async () => remainingStorageReferences,
    },
    aiArtistBio: { create: async ({ data }: { data: unknown }) => { createdBios.push(data); return data; }, update: async () => ({}) },
    auditLog: { create: async () => ({}) },
    $transaction: async (operations: Promise<unknown>[]) => Promise.all(operations),
  };
  const permission = { userHasPermissions: async () => true };
  const storage = {
    buildStorageKey: (concertId: string, documentId: string) => `artist-documents/${concertId}/${documentId}.pdf`,
    upload: async (key: string) => { uploadedStorageKeys.push(key); },
    remove: async (key: string) => { removedStorageKeys.push(key); },
  };
  const publisher = { publish: async (event: unknown) => { if (publishFails) throw new Error('Kafka down'); published.push(event); } };
  const redis = { del: async () => undefined };
  const serviceConfig = new ConfigService({
    MINIO_ACCESS_KEY: 'test',
    MINIO_SECRET_KEY: 'test-secret',
    AI_PROVIDER: 'mock',
    AI_TEXT_MAX_CHARS: '4000',
    PDF_MIN_TEXT_CHARS: '50',
    KAFKA_BROKERS: 'localhost:9092',
    AI_BIO_PROCESSING_MODE: processingMode,
  });
  const validator = new PdfTextExtractor(serviceConfig);
  const extractor = {
    assertValidPdf: validator.assertValidPdf.bind(validator),
    extract: async () => 'Artist press kit source text that is long enough for inline processing.',
  };
  const ai = {
    generate: async (text: string, previousBio?: string) => {
      generatedInputs.push({ text, previousBio });
      return 'Generated biography';
    },
  };
  const service = new ArtistDocumentsService(
    prisma as never,
    permission as never,
    storage as never,
    publisher as never,
    extractor as never,
    ai as never,
    redis as never,
    serviceConfig,
  );
  return { service, published, created, createdBios, deleted, removedStorageKeys, uploadedStorageKeys, generatedInputs };
}

test('Vercel defaults artist biography processing to inline mode', () => {
  const artistBioConfig = getArtistBioConfig(new ConfigService({
    VERCEL: '1',
    MINIO_ACCESS_KEY: 'unused',
    MINIO_SECRET_KEY: 'unused',
  }));
  assert.equal(artistBioConfig.processingMode, 'inline');
});

test('inline upload extracts, generates, and persists without MinIO or Kafka', async () => {
  const harness = artistServiceHarness('owner', false, true, null, 0, 'inline');
  const result = await harness.service.upload({ id: 'owner', email: 'owner@test' }, '11111111-1111-4111-8111-111111111111', {
    originalname: 'press-kit.pdf', mimetype: 'application/pdf', size: 12, buffer: Buffer.from('%PDF-1.4 demo'),
  });

  assert.equal(result.status, 'done');
  assert.equal(harness.uploadedStorageKeys.length, 0);
  assert.equal(harness.published.length, 0);
  assert.equal(harness.generatedInputs.length, 1);
  assert.equal(harness.created.length, 1);
  assert.equal(harness.createdBios.length, 1);
  assert.equal((harness.created[0] as { status: ArtistDocumentStatus }).status, ArtistDocumentStatus.DONE);
  assert.match((harness.created[0] as { storageKey: string }).storageKey, /^inline:\/\//);
});

test('owned organizer upload persists and publishes before returning uploaded', async () => {
  const harness = artistServiceHarness();
  const result = await harness.service.upload({ id: 'owner', email: 'owner@test' }, '11111111-1111-4111-8111-111111111111', {
    originalname: 'press-kit.pdf', mimetype: 'application/pdf', size: 12, buffer: Buffer.from('%PDF-1.4 demo'),
  });
  assert.equal(result.status, 'uploaded');
  assert.equal(harness.created.length, 1);
  assert.equal(harness.published.length, 1);
});

test('upload with an approved preview stores a completed biography without publishing a worker job', async () => {
  const harness = artistServiceHarness();
  const result = await harness.service.upload({ id: 'owner', email: 'owner@test' }, '11111111-1111-4111-8111-111111111111', {
    originalname: 'press-kit.pdf', mimetype: 'application/pdf', size: 12, buffer: Buffer.from('%PDF-1.4 demo'),
  }, '  Approved biography  ');

  assert.equal(result.status, 'done');
  assert.equal(harness.published.length, 0);
  assert.equal(harness.created.length, 1);
  assert.equal((harness.created[0] as { status: ArtistDocumentStatus }).status, ArtistDocumentStatus.DONE);
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
  await assert.rejects(harness.service.remove(user, concertId, '22222222-2222-4222-8222-222222222222'), ConflictException);
  assert.equal(harness.created.length, 0);
  assert.equal(harness.published.length, 0);
});

test('deleting the last artist document removes its database record and PDF object', async () => {
  const documentId = '22222222-2222-4222-8222-222222222222';
  const storageKey = 'artist-documents/concert/source.pdf';
  const harness = artistServiceHarness('owner', false, true, {
    id: documentId,
    fileName: 'press-kit.pdf',
    storageKey,
    bio: { id: 'bio-1' },
  });

  await harness.service.remove({ id: 'owner', email: 'owner@test' }, '11111111-1111-4111-8111-111111111111', documentId);

  assert.deepEqual(harness.deleted, [documentId]);
  assert.deepEqual(harness.removedStorageKeys, [storageKey]);
});

test('deleting a regenerated history item keeps a PDF still referenced by another item', async () => {
  const documentId = '22222222-2222-4222-8222-222222222222';
  const harness = artistServiceHarness('owner', false, true, {
    id: documentId,
    fileName: 'press-kit.pdf',
    storageKey: 'artist-documents/concert/source.pdf',
    bio: null,
  }, 1);

  await harness.service.remove({ id: 'owner', email: 'owner@test' }, '11111111-1111-4111-8111-111111111111', documentId);

  assert.deepEqual(harness.deleted, [documentId]);
  assert.deepEqual(harness.removedStorageKeys, []);
});
