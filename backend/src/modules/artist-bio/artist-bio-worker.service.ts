import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AiArtistBioStatus, ArtistDocumentStatus } from '@prisma/client';
import { Consumer, Kafka } from 'kafkajs';
import { getArtistBioConfig, getKafkaConfig } from '../../config/app.config';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisCacheService } from '../redis-cache/redis-cache.service';
import { ArtistBioAiProvider, AiProviderError } from './artist-bio-ai.provider';
import { ArtistBioJobsPublisher } from './artist-bio-jobs.publisher';
import { ArtistDocumentStorage, StorageTimeoutError } from './artist-document.storage';
import { AiBioRequestedEvent, PDF_EXTRACTION_FAILURE } from './artist-bio.types';
import { PdfTextExtractionError, PdfTextExtractor } from './pdf-text-extractor';

@Injectable()
export class ArtistBioWorkerService {
  private readonly logger = new Logger(ArtistBioWorkerService.name);
  private readonly consumer: Consumer;
  private readonly kafka: Kafka;
  private readonly config;

  constructor(
    configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly storage: ArtistDocumentStorage,
    private readonly extractor: PdfTextExtractor,
    private readonly ai: ArtistBioAiProvider,
    private readonly publisher: ArtistBioJobsPublisher,
    private readonly redis: RedisCacheService,
  ) {
    this.config = getArtistBioConfig(configService);
    this.kafka = new Kafka({ clientId: 'ticketbox-ai-bio-worker', brokers: getKafkaConfig(configService).brokers });
    this.consumer = this.kafka.consumer({ groupId: this.config.groupId });
  }

  async run(): Promise<void> {
    const admin = this.kafka.admin();
    await admin.connect();
    try {
      await admin.createTopics({ topics: [{ topic: this.config.topic, numPartitions: 3, replicationFactor: 1 }], waitForLeaders: true });
    } finally {
      await admin.disconnect();
    }
    await this.republishUploaded();
    await this.consumer.connect();
    await this.consumer.subscribe({ topic: this.config.topic, fromBeginning: false });
    await this.consumer.run({ eachMessage: async ({ message }) => {
      if (!message.value) return;
      const event = JSON.parse(message.value.toString()) as AiBioRequestedEvent;
      await this.process(event);
    } });
  }

  async process(event: AiBioRequestedEvent): Promise<void> {
    const document = await this.prisma.artistDocument.findFirst({ where: { id: event.document_id, concertId: event.concert_id }, include: { bio: true } });
    if (!document || document.status !== ArtistDocumentStatus.UPLOADED) return;

    const claimed = await this.prisma.artistDocument.updateMany({
      where: {
        id: document.id,
        concertId: document.concertId,
        status: ArtistDocumentStatus.UPLOADED,
      },
      data: { status: ArtistDocumentStatus.EXTRACTING },
    });
    if (claimed.count !== 1) return;

    try {
      await this.prisma.aiArtistBio.upsert({
        where: { documentId: document.id },
        create: {
          documentId: document.id,
          concertId: document.concertId,
          status: AiArtistBioStatus.GENERATING,
        },
        update: { status: AiArtistBioStatus.GENERATING, failureReason: null },
      });

      const pdf = await this.retry(() => this.storage.download(document.storageKey), 3, (error) => error instanceof StorageTimeoutError, 500);
      const cleanedText = await this.extractor.extract(pdf);
      const extracted = await this.prisma.artistDocument.updateMany({
        where: { id: document.id, status: ArtistDocumentStatus.EXTRACTING },
        data: { status: ArtistDocumentStatus.EXTRACTED, extractedText: cleanedText },
      });
      if (extracted.count !== 1) return;

      const generating = await this.prisma.artistDocument.updateMany({
        where: { id: document.id, status: ArtistDocumentStatus.EXTRACTED },
        data: { status: ArtistDocumentStatus.GENERATING },
      });
      if (generating.count !== 1) return;

      const generatedBio = await this.generateWithRetry(cleanedText, event.previous_bio);
      const now = new Date();
      const [completedBio, completedDocument] = await this.prisma.$transaction([
        this.prisma.aiArtistBio.updateMany({
          where: { documentId: document.id, status: AiArtistBioStatus.GENERATING },
          data: { status: AiArtistBioStatus.DONE, generatedBio, failureReason: null, generatedAt: now },
        }),
        this.prisma.artistDocument.updateMany({
          where: { id: document.id, status: ArtistDocumentStatus.GENERATING },
          data: { status: ArtistDocumentStatus.DONE },
        }),
      ]);
      if (completedBio.count !== 1 || completedDocument.count !== 1) return;
      await this.redis.del(`concerts:detail:${document.concertId}`);
    } catch (error) {
      const reason = error instanceof PdfTextExtractionError ? PDF_EXTRACTION_FAILURE : this.safeFailure(error);
      const [, failedDocument] = await this.prisma.$transaction([
        this.prisma.aiArtistBio.updateMany({
          where: { documentId: document.id, status: AiArtistBioStatus.GENERATING },
          data: { status: AiArtistBioStatus.FAILED, failureReason: reason },
        }),
        this.prisma.artistDocument.updateMany({
          where: {
            id: document.id,
            status: {
              in: [
                ArtistDocumentStatus.EXTRACTING,
                ArtistDocumentStatus.EXTRACTED,
                ArtistDocumentStatus.GENERATING,
              ],
            },
          },
          data: { status: ArtistDocumentStatus.FAILED },
        }),
      ]);
      if (failedDocument.count !== 1) return;
      this.logger.warn(`AI biography document ${document.id} failed: ${reason}`);
    }
  }

  async republishUploaded(): Promise<void> {
    const pending = await this.prisma.artistDocument.findMany({ where: { status: ArtistDocumentStatus.UPLOADED }, orderBy: { createdAt: 'asc' } });
    for (const document of pending) {
      await this.publisher.publish({ document_id: document.id, concert_id: document.concertId, storage_key: document.storageKey, attempt: 1 });
    }
  }

  private async generateWithRetry(text: string, previousBio?: string): Promise<string> {
    let attempt = 0;
    while (attempt < 2) {
      attempt += 1;
      try { return await this.ai.generate(text, previousBio); }
      catch (error) {
        if (!(error instanceof AiProviderError)) throw error;
        if (error.kind === 'rate_limit' && attempt < 2) { await this.sleep(this.config.aiRateLimitRetryMs); continue; }
        if (error.kind === 'timeout' && attempt < 2) { await this.sleep(500 * attempt); continue; }
        throw error;
      }
    }
    throw new AiProviderError('unavailable', 'AI provider retry limit exhausted');
  }

  private async retry<T>(operation: () => Promise<T>, maxAttempts: number, retryable: (error: unknown) => boolean, baseDelayMs: number): Promise<T> {
    let lastError: unknown;
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try { return await operation(); }
      catch (error) {
        lastError = error;
        if (!retryable(error) || attempt === maxAttempts) throw error;
        await this.sleep(baseDelayMs * 2 ** (attempt - 1));
      }
    }
    throw lastError;
  }

  private safeFailure(error: unknown): string {
    if (error instanceof StorageTimeoutError) return 'Object storage timed out after 3 attempts.';
    if (error instanceof AiProviderError && error.kind === 'timeout') return 'AI model timed out after 2 attempts.';
    if (error instanceof AiProviderError && error.kind === 'rate_limit') return 'AI model remained rate limited.';
    if (error instanceof AiProviderError) return 'AI model is unavailable.';
    return 'Artist biography processing failed.';
  }

  private sleep(ms: number): Promise<void> { return new Promise((resolve) => setTimeout(resolve, ms)); }
}
