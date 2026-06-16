import { readFile } from 'node:fs/promises';
import { extname, isAbsolute, join, resolve } from 'node:path';
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ImportErrorType, ImportStatus, Prisma, VipGuestImport } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  VIP_IMPORT_REQUIRED_COLUMNS,
  buildIdentityKey,
  buildVipQrHash,
  getCsvValue,
  isValidEmail,
  normalizeEmail,
  normalizeName,
  normalizePhone,
  parseCsv,
} from './vip-csv';
import { VipImportProcessResult } from './vip-imports.types';

type ImportRecord = VipGuestImport;

type RowCounters = {
  totalRows: number;
  acceptedRows: number;
  rejectedRows: number;
  duplicateRows: number;
};

type PendingImportError = {
  type: ImportErrorType;
  rowNumber?: number;
  field?: string;
  code: string;
  message: string;
  rawRow?: Prisma.InputJsonValue;
  metadata?: Prisma.InputJsonValue;
};

type AcceptedGuestInput = {
  sponsorSource: string;
  externalGuestKey: string | null;
  qrHash: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  normalizedFullName: string;
  normalizedEmail: string | null;
  normalizedPhone: string | null;
  normalizedIdentityKey: string | null;
  sourceRowNumber: number;
  sponsorCompany: string | null;
  invitedBy: string | null;
  guestType: string | null;
  allowedGate: string | null;
  notes: string | null;
};

const PROCESSABLE_IMPORT_STATUSES = [
  ImportStatus.PENDING,
  ImportStatus.QUEUED,
  ImportStatus.RETRYABLE_FAILED,
];

@Injectable()
export class VipImportWorkerService {
  private readonly logger = new Logger(VipImportWorkerService.name);
  private readonly batchSize = Number(process.env.VIP_IMPORT_BATCH_SIZE || 100);

  constructor(private readonly prisma: PrismaService) {}

  async processPendingImports(limit = 10): Promise<VipImportProcessResult[]> {
    const imports = await this.prisma.vipGuestImport.findMany({
      where: {
        status: {
          in: PROCESSABLE_IMPORT_STATUSES,
        },
      },
      orderBy: [{ queuedAt: 'asc' }, { createdAt: 'asc' }],
      take: limit,
    });

    const results: VipImportProcessResult[] = [];

    for (const importRecord of imports) {
      results.push(await this.processImport(importRecord.id));
    }

    return results;
  }

  async processImport(importId: string): Promise<VipImportProcessResult> {
    const importRecord = await this.prisma.vipGuestImport.findUnique({
      where: { id: importId },
    });

    if (!importRecord) {
      throw new NotFoundException('VIP guest import not found');
    }

    await this.markProcessing(importRecord);

    try {
      const sourcePath = this.resolveSourcePath(importRecord);
      const fileFailure = await this.validateFile(importRecord, sourcePath);

      if (fileFailure) {
        return this.markFileFailure(importRecord.id, fileFailure);
      }

      const parsed = parseCsv(await readFile(sourcePath, 'utf8'));
      const counters: RowCounters = {
        totalRows: parsed.rows.length,
        acceptedRows: 0,
        rejectedRows: 0,
        duplicateRows: 0,
      };
      const seenGuestKeys = new Set<string>();
      const batchSize = Number.isFinite(this.batchSize) && this.batchSize > 0 ? this.batchSize : 100;

      await this.prisma.vipGuestImportError.deleteMany({
        where: { importId: importRecord.id },
      });

      for (let index = 0; index < parsed.rows.length; index += batchSize) {
        const batch = parsed.rows.slice(index, index + batchSize);

        await this.prisma.$transaction(async (tx) => {
          for (const row of batch) {
            await this.processRow(tx, importRecord, row, seenGuestKeys, counters);
          }

          await tx.vipGuestImport.update({
            where: { id: importRecord.id },
            data: {
              totalRows: counters.totalRows,
              acceptedRows: counters.acceptedRows,
              rejectedRows: counters.rejectedRows,
              duplicateRows: counters.duplicateRows,
            },
          });
        });
      }

      const completed = await this.prisma.vipGuestImport.update({
        where: { id: importRecord.id },
        data: {
          status: ImportStatus.COMPLETED,
          totalRows: counters.totalRows,
          acceptedRows: counters.acceptedRows,
          rejectedRows: counters.rejectedRows,
          duplicateRows: counters.duplicateRows,
          failureCode: null,
          failureMessage: null,
          importedAt: new Date(),
        },
      });

      await this.auditImport(importRecord.id, 'vip_import.completed', counters);

      return this.toProcessResult(completed);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown worker error';
      this.logger.warn(`VIP import ${importId} failed during processing: ${message}`);

      const failed = await this.prisma.vipGuestImport.update({
        where: { id: importRecord.id },
        data: {
          status: ImportStatus.RETRYABLE_FAILED,
          failureCode: 'WORKER_ERROR',
          failureMessage: message,
        },
      });

      await this.auditImport(importRecord.id, 'vip_import.retryable_failed', { message });

      return this.toProcessResult(failed);
    }
  }

  private async validateFile(
    importRecord: ImportRecord,
    sourcePath: string,
  ): Promise<PendingImportError | null> {
    if (extname(sourcePath).toLowerCase() !== '.csv') {
      return {
        type: ImportErrorType.FILE,
        code: 'UNSUPPORTED_FORMAT',
        message: 'VIP guest import source must be a .csv file',
        metadata: { sourcePath },
      };
    }

    let content: string;

    try {
      content = await readFile(sourcePath, 'utf8');
    } catch (error) {
      return {
        type: ImportErrorType.FILE,
        code: 'UNREADABLE_FILE',
        message: error instanceof Error ? error.message : 'CSV file could not be read',
        metadata: { sourcePath },
      };
    }

    const parsed = parseCsv(content);

    if (parsed.headers.length === 0) {
      return {
        type: ImportErrorType.FILE,
        code: 'MISSING_HEADER',
        message: 'CSV file is missing a header row',
        metadata: { fileName: importRecord.fileName },
      };
    }

    const missingColumns = VIP_IMPORT_REQUIRED_COLUMNS.filter(
      (column) => !parsed.headers.includes(column),
    );

    if (missingColumns.length > 0) {
      return {
        type: ImportErrorType.FILE,
        code: 'MISSING_REQUIRED_COLUMNS',
        message: `CSV file is missing required columns: ${missingColumns.join(', ')}`,
        metadata: { missingColumns },
      };
    }

    return null;
  }

  private async processRow(
    tx: Prisma.TransactionClient,
    importRecord: ImportRecord,
    row: ReturnType<typeof parseCsv>['rows'][number],
    seenGuestKeys: Set<string>,
    counters: RowCounters,
  ): Promise<void> {
    const validationErrors = this.validateRow(row);

    if (validationErrors.length > 0) {
      counters.rejectedRows += 1;

      for (const error of validationErrors) {
        await this.createImportError(tx, importRecord.id, error);
      }

      return;
    }

    const guestInput = this.toAcceptedGuestInput(importRecord, row);
    const duplicateKey = guestInput.externalGuestKey
      ? `external:${guestInput.externalGuestKey.toLowerCase()}`
      : `identity:${guestInput.normalizedIdentityKey}`;

    if (seenGuestKeys.has(duplicateKey)) {
      counters.duplicateRows += 1;
      await this.createImportError(tx, importRecord.id, {
        type: ImportErrorType.DUPLICATE,
        rowNumber: row.rowNumber,
        code: 'DUPLICATE_IN_FILE',
        message: 'Guest identity is duplicated within the CSV file',
        rawRow: row.rawRow,
        metadata: { duplicateKey },
      });
      return;
    }

    seenGuestKeys.add(duplicateKey);

    const existing = await this.findExistingGuest(tx, importRecord.concertId, guestInput);

    if (existing && existing.importId !== importRecord.id) {
      counters.duplicateRows += 1;
      await this.createImportError(tx, importRecord.id, {
        type: ImportErrorType.DUPLICATE,
        rowNumber: row.rowNumber,
        code: 'DUPLICATE_EXISTING_GUEST',
        message: 'Guest identity already exists for this concert and sponsor source',
        rawRow: row.rawRow,
        metadata: {
          duplicateGuestId: existing.id,
          duplicateKey,
        },
      });
      return;
    }

    if (existing) {
      await tx.vipGuest.update({
        where: { id: existing.id },
        data: this.toGuestUpdateData(guestInput),
      });
    } else {
      await tx.vipGuest.create({
        data: {
          importId: importRecord.id,
          concertId: importRecord.concertId,
          ...this.toGuestCreateData(guestInput),
        },
      });
    }

    counters.acceptedRows += 1;
  }

  private validateRow(row: ReturnType<typeof parseCsv>['rows'][number]): PendingImportError[] {
    const errors: PendingImportError[] = [];

    if (row.hasColumnCountMismatch) {
      return [
        {
          type: ImportErrorType.ROW,
          rowNumber: row.rowNumber,
          code: 'COLUMN_COUNT_MISMATCH',
          message: 'CSV row does not match the header column count',
          rawRow: row.rawRow,
        },
      ];
    }

    const fullName = getCsvValue(row, 'full_name');
    const externalGuestKey = getCsvValue(row, 'external_guest_key');
    const email = normalizeEmail(getCsvValue(row, 'email'));
    const phone = normalizePhone(getCsvValue(row, 'phone'));

    if (!fullName) {
      errors.push({
        type: ImportErrorType.ROW,
        rowNumber: row.rowNumber,
        field: 'full_name',
        code: 'FULL_NAME_REQUIRED',
        message: 'VIP guest full_name is required',
        rawRow: row.rawRow,
      });
    }

    if (email && !isValidEmail(email)) {
      errors.push({
        type: ImportErrorType.ROW,
        rowNumber: row.rowNumber,
        field: 'email',
        code: 'EMAIL_INVALID',
        message: 'VIP guest email is malformed',
        rawRow: row.rawRow,
      });
    }

    if (!externalGuestKey && !email && !phone) {
      errors.push({
        type: ImportErrorType.ROW,
        rowNumber: row.rowNumber,
        code: 'IDENTITY_REQUIRED',
        message: 'VIP guest row needs external_guest_key, email, or phone',
        rawRow: row.rawRow,
      });
    }

    return errors;
  }

  private toAcceptedGuestInput(
    importRecord: ImportRecord,
    row: ReturnType<typeof parseCsv>['rows'][number],
  ): AcceptedGuestInput {
    const fullName = getCsvValue(row, 'full_name') ?? '';
    const displayName = fullName.trim().replace(/\s+/g, ' ');
    const normalizedFullName = normalizeName(fullName);
    const normalizedEmail = normalizeEmail(getCsvValue(row, 'email'));
    const normalizedPhone = normalizePhone(getCsvValue(row, 'phone'));
    const externalGuestKey = getCsvValue(row, 'external_guest_key');
    const normalizedIdentityKey = externalGuestKey
      ? null
      : buildIdentityKey({
          normalizedEmail,
          normalizedPhone,
          normalizedFullName,
        });

    return {
      sponsorSource:
        getCsvValue(row, 'sponsor_source') ?? importRecord.sourceName ?? 'SPONSOR_CSV',
      externalGuestKey,
      qrHash: buildVipQrHash({
        concertId: importRecord.concertId,
        sponsorSource: getCsvValue(row, 'sponsor_source') ?? importRecord.sourceName,
        externalGuestKey,
        normalizedIdentityKey,
      }),
      fullName: displayName,
      email: normalizedEmail,
      phone: normalizedPhone,
      normalizedFullName,
      normalizedEmail,
      normalizedPhone,
      normalizedIdentityKey,
      sourceRowNumber: row.rowNumber,
      sponsorCompany: getCsvValue(row, 'sponsor_company') ?? getCsvValue(row, 'company'),
      invitedBy: getCsvValue(row, 'invited_by'),
      guestType: getCsvValue(row, 'guest_type'),
      allowedGate: getCsvValue(row, 'allowed_gate'),
      notes: getCsvValue(row, 'notes'),
    };
  }

  private async findExistingGuest(
    tx: Prisma.TransactionClient,
    concertId: string,
    guestInput: AcceptedGuestInput,
  ) {
    if (guestInput.externalGuestKey) {
      return tx.vipGuest.findFirst({
        where: {
          concertId,
          sponsorSource: guestInput.sponsorSource,
          externalGuestKey: guestInput.externalGuestKey,
        },
        select: { id: true, importId: true },
      });
    }

    return tx.vipGuest.findFirst({
      where: {
        concertId,
        sponsorSource: guestInput.sponsorSource,
        normalizedIdentityKey: guestInput.normalizedIdentityKey,
      },
      select: { id: true, importId: true },
    });
  }

  private toGuestCreateData(
    guestInput: AcceptedGuestInput,
  ): Omit<Prisma.VipGuestUncheckedCreateInput, 'concertId' | 'importId'> {
    return {
      sponsorSource: guestInput.sponsorSource,
      externalGuestKey: guestInput.externalGuestKey,
      qrHash: guestInput.qrHash,
      fullName: guestInput.fullName,
      email: guestInput.email,
      phone: guestInput.phone,
      normalizedFullName: guestInput.normalizedFullName,
      normalizedEmail: guestInput.normalizedEmail,
      normalizedPhone: guestInput.normalizedPhone,
      normalizedIdentityKey: guestInput.normalizedIdentityKey,
      sourceRowNumber: guestInput.sourceRowNumber,
      sponsorCompany: guestInput.sponsorCompany,
      invitedBy: guestInput.invitedBy,
      guestType: guestInput.guestType,
      allowedGate: guestInput.allowedGate,
      notes: guestInput.notes,
    };
  }

  private toGuestUpdateData(guestInput: AcceptedGuestInput): Prisma.VipGuestUncheckedUpdateInput {
    return {
      qrHash: guestInput.qrHash,
      fullName: guestInput.fullName,
      email: guestInput.email,
      phone: guestInput.phone,
      normalizedFullName: guestInput.normalizedFullName,
      normalizedEmail: guestInput.normalizedEmail,
      normalizedPhone: guestInput.normalizedPhone,
      normalizedIdentityKey: guestInput.normalizedIdentityKey,
      sourceRowNumber: guestInput.sourceRowNumber,
      sponsorCompany: guestInput.sponsorCompany,
      invitedBy: guestInput.invitedBy,
      guestType: guestInput.guestType,
      allowedGate: guestInput.allowedGate,
      notes: guestInput.notes,
    };
  }

  private async markProcessing(importRecord: ImportRecord): Promise<void> {
    await this.prisma.vipGuestImport.update({
      where: { id: importRecord.id },
      data: {
        status: ImportStatus.PROCESSING,
        startedAt: new Date(),
        failureCode: null,
        failureMessage: null,
      },
    });

    await this.auditImport(importRecord.id, 'vip_import.processing', {
      fileName: importRecord.fileName,
      sourceName: importRecord.sourceName,
    });
  }

  private async markFileFailure(
    importId: string,
    error: PendingImportError,
  ): Promise<VipImportProcessResult> {
    const failed = await this.prisma.$transaction(async (tx) => {
      await tx.vipGuestImportError.deleteMany({
        where: { importId },
      });
      await this.createImportError(tx, importId, error);

      return tx.vipGuestImport.update({
        where: { id: importId },
        data: {
          status: ImportStatus.FAILED,
          totalRows: 0,
          acceptedRows: 0,
          rejectedRows: 0,
          duplicateRows: 0,
          failureCode: error.code,
          failureMessage: error.message,
        },
      });
    });

    await this.auditImport(importId, 'vip_import.failed', {
      code: error.code,
      message: error.message,
    });

    return this.toProcessResult(failed);
  }

  private async createImportError(
    tx: Prisma.TransactionClient,
    importId: string,
    error: PendingImportError,
  ): Promise<void> {
    await tx.vipGuestImportError.create({
      data: {
        importId,
        type: error.type,
        rowNumber: error.rowNumber,
        field: error.field,
        code: error.code,
        message: error.message,
        rawRow: error.rawRow,
        metadata: error.metadata,
      },
    });
  }

  private async auditImport(
    importId: string,
    action: string,
    metadata: Prisma.InputJsonValue,
  ): Promise<void> {
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

  private resolveSourcePath(importRecord: ImportRecord): string {
    if (importRecord.sourcePath) {
      return isAbsolute(importRecord.sourcePath)
        ? importRecord.sourcePath
        : resolve(process.cwd(), importRecord.sourcePath);
    }

    return join(this.getSourceDir(), importRecord.fileName);
  }

  private getSourceDir(): string {
    const sourceDir = process.env.VIP_CSV_SOURCE_DIR || join(process.cwd(), 'prisma', 'demo-sponsor-csv');

    return isAbsolute(sourceDir) ? sourceDir : resolve(process.cwd(), sourceDir);
  }

  private toProcessResult(importRecord: {
    id: string;
    status: ImportStatus;
    totalRows: number;
    acceptedRows: number;
    rejectedRows: number;
    duplicateRows: number;
  }): VipImportProcessResult {
    return {
      importId: importRecord.id,
      status: importRecord.status,
      totalRows: importRecord.totalRows,
      acceptedRows: importRecord.acceptedRows,
      rejectedRows: importRecord.rejectedRows,
      duplicateRows: importRecord.duplicateRows,
    };
  }
}
