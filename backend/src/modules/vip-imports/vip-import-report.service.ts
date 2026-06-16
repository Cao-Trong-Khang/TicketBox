import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ImportErrorType, ImportStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthenticatedUser } from '../auth/types';
import { PermissionService } from '../rbac/permission.service';
import { PERMISSION_CODES, ROLE_CODES } from '../rbac/rbac.constants';
import { VipImportDetailDto, VipImportErrorDto, VipImportListItemDto } from './vip-imports.types';

type ImportReportRecord = {
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
  _count: {
    errors: number;
  };
};

type ImportDetailRecord = ImportReportRecord & {
  errors: {
    id: string;
    type: ImportErrorType;
    rowNumber: number | null;
    field: string | null;
    code: string;
    message: string;
    rawRow: unknown;
    metadata: unknown;
    createdAt: Date;
  }[];
  auditLogs: {
    id: string;
    action: string;
    metadata: unknown;
    createdAt: Date;
  }[];
};

@Injectable()
export class VipImportReportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly permissionService: PermissionService,
  ) {}

  async listImportsForConcert(
    user: AuthenticatedUser,
    concertId: string,
  ): Promise<VipImportListItemDto[]> {
    await this.assertOrganizerCanManageConcert(user.id, concertId);

    const imports = await this.prisma.vipGuestImport.findMany({
      where: { concertId },
      orderBy: [{ createdAt: 'desc' }],
      include: {
        _count: {
          select: { errors: true },
        },
      },
    });

    return imports.map((importRecord) => this.toListItem(importRecord));
  }

  async getImportForConcert(
    user: AuthenticatedUser,
    concertId: string,
    importId: string,
  ): Promise<VipImportDetailDto> {
    await this.assertOrganizerCanManageConcert(user.id, concertId);

    const importRecord = await this.prisma.vipGuestImport.findFirst({
      where: {
        id: importId,
        concertId,
      },
      include: {
        errors: {
          orderBy: [{ rowNumber: 'asc' }, { createdAt: 'asc' }],
        },
        auditLogs: {
          orderBy: [{ createdAt: 'asc' }],
          select: {
            id: true,
            action: true,
            metadata: true,
            createdAt: true,
          },
        },
        _count: {
          select: { errors: true },
        },
      },
    });

    if (!importRecord) {
      throw new NotFoundException('VIP guest import not found');
    }

    return this.toDetail(importRecord);
  }

  private async assertOrganizerCanManageConcert(userId: string, concertId: string): Promise<void> {
    const [userRoles, hasManagementPermission, concert] = await Promise.all([
      this.prisma.userRole.findMany({
        where: { userId },
        include: {
          role: true,
        },
      }),
      this.permissionService.userHasPermissions(userId, [PERMISSION_CODES.concertUpdate]),
      this.prisma.concert.findUnique({
        where: { id: concertId },
        select: { organizerId: true },
      }),
    ]);

    if (!concert) {
      throw new NotFoundException('Concert not found');
    }

    const isOrganizer = userRoles.some((userRole) => userRole.role.code === ROLE_CODES.organizer);

    if (!isOrganizer || !hasManagementPermission || concert.organizerId !== userId) {
      throw new ForbiddenException('Organizer ownership and concert management permission are required');
    }
  }

  private toListItem(importRecord: ImportReportRecord): VipImportListItemDto {
    return {
      id: importRecord.id,
      concertId: importRecord.concertId,
      sourceName: importRecord.sourceName,
      fileName: importRecord.fileName,
      status: importRecord.status,
      totalRows: importRecord.totalRows,
      acceptedRows: importRecord.acceptedRows,
      rejectedRows: importRecord.rejectedRows,
      duplicateRows: importRecord.duplicateRows,
      failureCode: importRecord.failureCode,
      failureMessage: importRecord.failureMessage,
      queuedAt: importRecord.queuedAt?.toISOString() ?? null,
      startedAt: importRecord.startedAt?.toISOString() ?? null,
      importedAt: importRecord.importedAt?.toISOString() ?? null,
      createdAt: importRecord.createdAt.toISOString(),
      updatedAt: importRecord.updatedAt.toISOString(),
      errorCount: importRecord._count.errors,
    };
  }

  private toDetail(importRecord: ImportDetailRecord): VipImportDetailDto {
    return {
      ...this.toListItem(importRecord),
      sourcePath: importRecord.sourcePath,
      sourceFingerprint: importRecord.sourceFingerprint,
      errors: importRecord.errors.map((error) => this.toError(error)),
      auditTrail: importRecord.auditLogs.map((auditLog) => ({
        id: auditLog.id,
        action: auditLog.action,
        metadata: auditLog.metadata,
        createdAt: auditLog.createdAt.toISOString(),
      })),
    };
  }

  private toError(error: ImportDetailRecord['errors'][number]): VipImportErrorDto {
    return {
      id: error.id,
      type: error.type,
      rowNumber: error.rowNumber,
      field: error.field,
      code: error.code,
      message: error.message,
      rawRow: error.rawRow,
      metadata: error.metadata,
      createdAt: error.createdAt.toISOString(),
    };
  }
}
