import * as assert from 'node:assert/strict';
import { test } from 'node:test';
import { ConfigService } from '@nestjs/config';
import { AiArtistBioStatus, ArtistDocumentStatus, ConcertStatus } from '@prisma/client';
import { ConcertsService } from '../concerts/concerts.service';
import { ArtistBioWorkerService } from './artist-bio-worker.service';
import { ArtistDocumentsService } from './artist-documents.service';
import { AiBioRequestedEvent } from './artist-bio.types';
import { PdfTextExtractor } from './pdf-text-extractor';

type DocumentRecord = {
  id: string;
  concertId: string;
  fileName: string;
  storageKey: string;
  status: ArtistDocumentStatus;
  extractedText: string | null;
  uploadedAt: Date;
  createdAt: Date;
};

type BioRecord = {
  id: string;
  documentId: string;
  concertId: string;
  status: AiArtistBioStatus;
  generatedBio: string | null;
  failureReason: string | null;
  generatedAt: Date | null;
  createdAt: Date;
};

test('Artist Bio workflow keeps description separate from upload through public detail', async () => {
  const concertId = '11111111-1111-4111-8111-111111111111';
  const organizer = { id: '22222222-2222-4222-8222-222222222222', email: 'organizer@test' };
  const documents = new Map<string, DocumentRecord>();
  const bios = new Map<string, BioRecord>();
  const objects = new Map<string, Buffer>();
  const published: AiBioRequestedEvent[] = [];
  const invalidatedKeys: string[] = [];
  const now = new Date('2026-07-13T00:00:00.000Z');
  const performanceStartAt = new Date('2099-08-01T19:00:00.000Z');

  const prisma = {
    userRole: {
      findMany: async () => [{ role: { code: 'ORGANIZER' } }],
    },
    concert: {
      findUnique: async () => ({
        organizerId: organizer.id,
        status: ConcertStatus.PUBLISHED,
        startsAt: performanceStartAt,
        performanceStartAt,
      }),
      findFirst: async () => ({
        id: concertId,
        title: 'Monsoon Music Festival 2026',
        artistName: 'Monsoon Ensemble',
        description: 'Independent festival description',
        venueName: 'Festival Grounds',
        venueAddress: 'Ha Noi',
        bannerUrl: null,
        seatingSvg: null,
        startsAt: performanceStartAt,
        endsAt: null,
        performanceStartAt,
        aiArtistBios: [...bios.values()]
          .filter((bio) => bio.status === AiArtistBioStatus.DONE)
          .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime())
          .slice(0, 1)
          .map((bio) => ({ generatedBio: bio.generatedBio })),
      }),
    },
    artistDocument: {
      create: async ({ data }: { data: Pick<DocumentRecord, 'id' | 'concertId' | 'fileName' | 'storageKey'> }) => {
        const document: DocumentRecord = {
          ...data,
          status: ArtistDocumentStatus.UPLOADED,
          extractedText: null,
          uploadedAt: now,
          createdAt: now,
        };
        documents.set(document.id, document);
        return document;
      },
      findFirst: async ({ where }: { where: { id: string; concertId: string } }) => {
        const document = documents.get(where.id);
        if (!document || document.concertId !== where.concertId) return null;
        return { ...document, bio: bios.get(document.id) ?? null };
      },
      findMany: async () => [...documents.values()],
      update: async ({ where, data }: { where: { id: string }; data: Partial<DocumentRecord> }) => {
        const document = documents.get(where.id);
        assert.ok(document);
        Object.assign(document, data);
        return document;
      },
      updateMany: async ({ where, data }: {
        where: { id: string; concertId?: string; status: ArtistDocumentStatus | { in: ArtistDocumentStatus[] } };
        data: Partial<DocumentRecord>;
      }) => {
        const document = documents.get(where.id);
        if (!document || (where.concertId && document.concertId !== where.concertId)) return { count: 0 };
        const statuses = typeof where.status === 'object' ? where.status.in : [where.status];
        if (!statuses.includes(document.status)) return { count: 0 };
        Object.assign(document, data);
        return { count: 1 };
      },
    },
    aiArtistBio: {
      upsert: async ({ where, create, update }: {
        where: { documentId: string };
        create: Pick<BioRecord, 'documentId' | 'concertId' | 'status'>;
        update: Partial<BioRecord>;
      }) => {
        const existing = bios.get(where.documentId);
        if (existing) {
          Object.assign(existing, update);
          return existing;
        }
        const bio: BioRecord = {
          id: '33333333-3333-4333-8333-333333333333',
          ...create,
          generatedBio: null,
          failureReason: null,
          generatedAt: null,
          createdAt: now,
        };
        bios.set(bio.documentId, bio);
        return bio;
      },
      update: async ({ where, data }: { where: { documentId: string }; data: Partial<BioRecord> }) => {
        const bio = bios.get(where.documentId);
        assert.ok(bio);
        Object.assign(bio, data);
        return bio;
      },
      updateMany: async ({ where, data }: {
        where: { documentId: string; status: AiArtistBioStatus };
        data: Partial<BioRecord>;
      }) => {
        const bio = bios.get(where.documentId);
        if (!bio || bio.status !== where.status) return { count: 0 };
        Object.assign(bio, data);
        return { count: 1 };
      },
    },
    auditLog: { create: async () => ({}) },
    $transaction: async (operations: Promise<unknown>[]) => Promise.all(operations),
  };
  const storage = {
    buildStorageKey: (id: string, documentId: string) => `artist-documents/${id}/${documentId}.pdf`,
    upload: async (key: string, value: Buffer) => { objects.set(key, value); },
    download: async (key: string) => {
      const value = objects.get(key);
      assert.ok(value);
      return value;
    },
    remove: async (key: string) => { objects.delete(key); },
  };
  const publisher = {
    publish: async (event: AiBioRequestedEvent) => { published.push(event); },
  };
  const redis = {
    get: async () => null,
    set: async () => undefined,
    del: async (key: string) => { invalidatedKeys.push(key); },
  };
  const permission = { userHasPermissions: async () => true };
  const config = new ConfigService({
    MINIO_ACCESS_KEY: 'test',
    MINIO_SECRET_KEY: 'test-secret',
    AI_PROVIDER: 'mock',
    AI_TEXT_MAX_CHARS: '4000',
    PDF_MIN_TEXT_CHARS: '50',
    KAFKA_BROKERS: 'localhost:9092',
  });
  const documentsService = new ArtistDocumentsService(
    prisma as never,
    permission as never,
    storage as never,
    publisher as never,
    new PdfTextExtractor(config),
    { generate: async () => 'Generated biography' } as never,
    redis as never,
    config,
  );

  const upload = await documentsService.upload(organizer, concertId, {
    originalname: 'monsoon-press-kit.pdf',
    mimetype: 'application/pdf',
    size: 18,
    buffer: Buffer.from('%PDF-1.7 press kit'),
  });
  assert.equal(upload.status, 'uploaded');
  assert.equal(published.length, 1);

  const worker = new ArtistBioWorkerService(
    config,
    prisma as never,
    storage as never,
    { extract: async () => 'Monsoon Ensemble source biography' } as never,
    { generate: async () => 'Generated Monsoon biography' } as never,
    publisher as never,
    redis as never,
  );
  await worker.process(published[0]);

  const generated = await documentsService.detail(organizer, concertId, upload.document_id);
  assert.equal(generated.status, 'done');
  assert.equal(generated.generated_bio, 'Generated Monsoon biography');

  await documentsService.updateBio(
    organizer,
    concertId,
    upload.document_id,
    'Organizer approved Monsoon biography',
  );

  const publicDetail = await new ConcertsService(prisma as never, redis as never)
    .findPublishedConcertDetail(concertId);
  assert.equal(publicDetail.description, 'Independent festival description');
  assert.equal(publicDetail.artist_bio, 'Organizer approved Monsoon biography');
  assert.notEqual(publicDetail.description, publicDetail.artist_bio);
  assert.ok(invalidatedKeys.filter((key) => key === `concerts:detail:${concertId}`).length >= 2);
});
