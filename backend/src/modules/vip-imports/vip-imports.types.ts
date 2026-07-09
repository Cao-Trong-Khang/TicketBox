import { ImportErrorType, ImportStatus } from '@prisma/client';

export const VIP_GUEST_IMPORT_REQUESTED_TOPIC = 'vip-guest-import.requested';

export type VipGuestImportRequestedJob = {
  importId: string;
  concertId: string;
  sourceName: string;
  fileName: string;
  sourcePath: string | null;
  sourceFingerprint: string;
};

export type VipImportScanResult = {
  detected: number;
  queued: number;
  failedToEnqueue: number;
  skipped: number;
  imports: {
    id: string;
    fileName: string;
    status: ImportStatus;
  }[];
};

export type VipImportProcessResult = {
  importId: string;
  status: ImportStatus;
  totalRows: number;
  acceptedRows: number;
  rejectedRows: number;
  duplicateRows: number;
};

export type VipImportErrorDto = {
  id: string;
  type: ImportErrorType;
  rowNumber: number | null;
  field: string | null;
  code: string;
  message: string;
  rawRow: unknown;
  metadata: unknown;
  createdAt: string;
};

export type VipImportListItemDto = {
  id: string;
  concertId: string;
  sourceName: string;
  fileName: string;
  status: ImportStatus;
  totalRows: number;
  acceptedRows: number;
  rejectedRows: number;
  duplicateRows: number;
  failureCode: string | null;
  failureMessage: string | null;
  queuedAt: string | null;
  startedAt: string | null;
  importedAt: string | null;
  createdAt: string;
  updatedAt: string;
  errorCount: number;
};

export type VipImportDetailDto = VipImportListItemDto & {
  sourcePath: string | null;
  sourceFingerprint: string;
  errors: VipImportErrorDto[];
  auditTrail: {
    id: string;
    action: string;
    metadata: unknown;
    createdAt: string;
  }[];
};
