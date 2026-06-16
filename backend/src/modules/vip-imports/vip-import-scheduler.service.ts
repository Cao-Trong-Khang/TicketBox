import { readdir, readFile, stat } from 'node:fs/promises';
import { basename, extname, isAbsolute, join, resolve } from 'node:path';
import { Injectable, Logger } from '@nestjs/common';
import { ImportStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { getCsvValue, parseCsv, sha256 } from './vip-csv';
import { VipImportJobsPublisher } from './vip-import-jobs.publisher';
import { VipImportScanResult } from './vip-imports.types';

type ResolvedCsvMetadata = {
  concertId: string;
  sourceName: string;
};

const RETRYABLE_ENQUEUE_STATUSES = new Set<ImportStatus>([
  ImportStatus.DETECTED,
  ImportStatus.PENDING,
  ImportStatus.FAILED_TO_ENQUEUE,
  ImportStatus.RETRYABLE_FAILED,
]);

@Injectable()
export class VipImportSchedulerService {
  private readonly logger = new Logger(VipImportSchedulerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly publisher: VipImportJobsPublisher,
  ) {}

  async scanScheduledImports(sourceDir = this.getSourceDir()): Promise<VipImportScanResult> {
    const absoluteSourceDir = isAbsolute(sourceDir) ? sourceDir : resolve(process.cwd(), sourceDir);
    const entries = await readdir(absoluteSourceDir);
    const result: VipImportScanResult = {
      detected: 0,
      queued: 0,
      failedToEnqueue: 0,
      skipped: 0,
      imports: [],
    };

    for (const entry of entries.sort()) {
      const sourcePath = join(absoluteSourceDir, entry);
      const fileStat = await stat(sourcePath);

      if (!fileStat.isFile() || extname(entry).toLowerCase() !== '.csv') {
        result.skipped += 1;
        continue;
      }

      const buffer = await readFile(sourcePath);
      const metadata = await this.resolveCsvMetadata(buffer.toString('utf8'));

      if (!metadata) {
        this.logger.warn(`Skipping ${entry}: no concert_id or concert_title metadata`);
        result.skipped += 1;
        continue;
      }

      const sourceFingerprint = sha256(buffer);
      const importRecord = await this.findOrCreateImport({
        concertId: metadata.concertId,
        sourceName: metadata.sourceName,
        fileName: basename(sourcePath),
        sourcePath,
        sourceFingerprint,
      });

      result.detected += 1;

      if (!RETRYABLE_ENQUEUE_STATUSES.has(importRecord.status)) {
        result.skipped += 1;
        result.imports.push({
          id: importRecord.id,
          fileName: importRecord.fileName,
          status: importRecord.status,
        });
        continue;
      }

      try {
        await this.publisher.publishImportRequested({
          importId: importRecord.id,
          concertId: importRecord.concertId,
          sourceName: importRecord.sourceName,
          fileName: importRecord.fileName,
          sourcePath: importRecord.sourcePath,
          sourceFingerprint: importRecord.sourceFingerprint,
        });

        const queued = await this.prisma.vipGuestImport.update({
          where: { id: importRecord.id },
          data: {
            status: ImportStatus.QUEUED,
            queuedAt: new Date(),
            failureCode: null,
            failureMessage: null,
          },
        });

        await this.auditImport(queued.id, 'vip_import.queued', {
          fileName: queued.fileName,
          sourceName: queued.sourceName,
        });

        result.queued += 1;
        result.imports.push({
          id: queued.id,
          fileName: queued.fileName,
          status: queued.status,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown Kafka publish error';
        const failed = await this.prisma.vipGuestImport.update({
          where: { id: importRecord.id },
          data: {
            status: ImportStatus.FAILED_TO_ENQUEUE,
            failureCode: 'KAFKA_ENQUEUE_FAILED',
            failureMessage: message,
          },
        });

        await this.auditImport(failed.id, 'vip_import.enqueue_failed', {
          fileName: failed.fileName,
          sourceName: failed.sourceName,
          message,
        });

        result.failedToEnqueue += 1;
        result.imports.push({
          id: failed.id,
          fileName: failed.fileName,
          status: failed.status,
        });
      }
    }

    return result;
  }

  private async findOrCreateImport(input: {
    concertId: string;
    sourceName: string;
    fileName: string;
    sourcePath: string;
    sourceFingerprint: string;
  }) {
    const existing = await this.prisma.vipGuestImport.findFirst({
      where: {
        concertId: input.concertId,
        sourceName: input.sourceName,
        sourceFingerprint: input.sourceFingerprint,
      },
    });

    if (existing) {
      return existing;
    }

    const created = await this.prisma.vipGuestImport.create({
      data: {
        concertId: input.concertId,
        sourceName: input.sourceName,
        fileName: input.fileName,
        sourcePath: input.sourcePath,
        sourceFingerprint: input.sourceFingerprint,
        status: ImportStatus.DETECTED,
      },
    });

    await this.auditImport(created.id, 'vip_import.detected', {
      fileName: created.fileName,
      sourceName: created.sourceName,
      sourceFingerprint: created.sourceFingerprint,
    });

    return created;
  }

  private async resolveCsvMetadata(content: string): Promise<ResolvedCsvMetadata | null> {
    const parsed = parseCsv(content);
    const firstRow = parsed.rows[0];

    if (!firstRow) {
      return null;
    }

    const concertId = getCsvValue(firstRow, 'concert_id');
    const concertTitle = getCsvValue(firstRow, 'concert_title');
    const sourceName =
      getCsvValue(firstRow, 'sponsor_source') ??
      process.env.VIP_CSV_DEFAULT_SOURCE_NAME ??
      'SPONSOR_CSV';

    const concert = concertId
      ? await this.prisma.concert.findUnique({
          where: { id: concertId },
          select: { id: true },
        })
      : concertTitle
        ? await this.prisma.concert.findFirst({
            where: { title: concertTitle },
            select: { id: true },
          })
        : null;

    if (!concert) {
      return null;
    }

    return {
      concertId: concert.id,
      sourceName: sourceName.trim() || 'SPONSOR_CSV',
    };
  }

  private async auditImport(importId: string, action: string, metadata: Prisma.InputJsonValue) {
    await this.prisma.auditLog.create({
      data: {
        importId,
        entityType: 'vip_guest_import',
        entityId: importId,
        action,
        metadata,
      },
    });
  }

  private getSourceDir(): string {
    return process.env.VIP_CSV_SOURCE_DIR || join(process.cwd(), 'prisma', 'demo-sponsor-csv');
  }
}
