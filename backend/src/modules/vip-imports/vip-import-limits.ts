import { createReadStream, type Stats } from 'node:fs';
import { stat } from 'node:fs/promises';

export const DEFAULT_VIP_IMPORT_MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;
export const DEFAULT_VIP_IMPORT_MAX_ROWS = 10_000;
export const VIP_IMPORT_FILE_TOO_LARGE_CODE = 'VIP_IMPORT_FILE_TOO_LARGE';
export const VIP_IMPORT_TOO_MANY_ROWS_CODE = 'VIP_IMPORT_TOO_MANY_ROWS';

export type VipImportLimits = {
  maxFileSizeBytes: number;
  maxRows: number;
};

export type VipImportFileInspection = {
  fileSizeBytes: number;
  rowCount: number;
};

type VipImportLimitMetadata = {
  sourcePath: string;
  fileSizeBytes?: number;
  maxFileSizeBytes?: number;
  rowCount?: number;
  maxRows?: number;
};

export class VipImportLimitError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly metadata: VipImportLimitMetadata,
  ) {
    super(message);
    this.name = 'VipImportLimitError';
  }
}

export async function inspectVipImportFile(
  sourcePath: string,
  options: { fileStat?: Stats; limits?: VipImportLimits } = {},
): Promise<VipImportFileInspection> {
  const limits = options.limits ?? getVipImportLimits();
  const fileStat = options.fileStat ?? (await stat(sourcePath));

  if (fileStat.size > limits.maxFileSizeBytes) {
    throw new VipImportLimitError(
      VIP_IMPORT_FILE_TOO_LARGE_CODE,
      `VIP CSV file exceeds the maximum size of ${limits.maxFileSizeBytes} bytes`,
      {
        sourcePath,
        fileSizeBytes: fileStat.size,
        maxFileSizeBytes: limits.maxFileSizeBytes,
      },
    );
  }

  const rowCount = await countVipImportCsvRows(sourcePath, limits.maxRows);

  return {
    fileSizeBytes: fileStat.size,
    rowCount,
  };
}

export function getVipImportLimits(): VipImportLimits {
  return {
    maxFileSizeBytes: readPositiveIntegerEnv(
      'VIP_IMPORT_MAX_FILE_SIZE_BYTES',
      DEFAULT_VIP_IMPORT_MAX_FILE_SIZE_BYTES,
    ),
    maxRows: readPositiveIntegerEnv('VIP_IMPORT_MAX_ROWS', DEFAULT_VIP_IMPORT_MAX_ROWS),
  };
}

async function countVipImportCsvRows(sourcePath: string, maxRows: number): Promise<number> {
  const stream = createReadStream(sourcePath, { encoding: 'utf8' });
  let recordIndex = 0;
  let dataRows = 0;
  let recordExists = false;
  let recordHasNonWhitespaceValue = false;
  let inQuotes = false;
  let quoteJustClosed = false;
  let previousWasCarriageReturn = false;

  const finishRecord = (existsFromLineBreak = false) => {
    const exists = recordExists || existsFromLineBreak;

    if (!exists) {
      return;
    }

    if (recordIndex > 0 && recordHasNonWhitespaceValue) {
      dataRows += 1;

      if (dataRows > maxRows) {
        throw new VipImportLimitError(
          VIP_IMPORT_TOO_MANY_ROWS_CODE,
          `VIP CSV file exceeds the maximum of ${maxRows} data rows`,
          {
            sourcePath,
            rowCount: dataRows,
            maxRows,
          },
        );
      }
    }

    recordIndex += 1;
    recordExists = false;
    recordHasNonWhitespaceValue = false;
    inQuotes = false;
    quoteJustClosed = false;
  };

  try {
    for await (const chunk of stream) {
      for (const character of chunk) {
        if (previousWasCarriageReturn) {
          previousWasCarriageReturn = false;

          if (character === '\n' && !inQuotes && !quoteJustClosed) {
            continue;
          }
        }

        if (quoteJustClosed) {
          if (character === '"') {
            recordExists = true;
            recordHasNonWhitespaceValue = true;
            quoteJustClosed = false;
            continue;
          }

          quoteJustClosed = false;
          inQuotes = false;
        }

        if (!inQuotes && character === '\r') {
          finishRecord(true);
          previousWasCarriageReturn = true;
          continue;
        }

        if (!inQuotes && character === '\n') {
          finishRecord(true);
          continue;
        }

        recordExists = true;

        if (character === '"') {
          if (inQuotes) {
            quoteJustClosed = true;
          } else {
            inQuotes = true;
          }
          continue;
        }

        if (character === ',' && !inQuotes) {
          continue;
        }

        if (/\S/u.test(character)) {
          recordHasNonWhitespaceValue = true;
        }
      }
    }

    finishRecord();
  } catch (error) {
    stream.destroy();
    throw error;
  }

  return dataRows;
}

function readPositiveIntegerEnv(name: string, fallback: number): number {
  const parsed = Number(process.env[name]);

  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}
