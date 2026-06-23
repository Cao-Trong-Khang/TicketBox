import { createHash } from 'node:crypto';

export const VIP_IMPORT_REQUIRED_COLUMNS = ['full_name'] as const;
export const VIP_IMPORT_CSV_DELIMITER = ',';
export const VIP_IMPORT_UNSUPPORTED_DELIMITER_CODE = 'UNSUPPORTED_DELIMITER';

type AlternateCsvDelimiter = {
  delimiter: string;
  name: string;
};

type UnsupportedCsvDelimiterMetadata = {
  detectedDelimiter: string;
  detectedDelimiterName: string;
  supportedDelimiter: string;
};

const ALTERNATE_CSV_DELIMITERS: AlternateCsvDelimiter[] = [
  { delimiter: ';', name: 'semicolon (;)' },
  { delimiter: '\t', name: 'tab (\\t)' },
  { delimiter: '|', name: 'pipe (|)' },
];

export type ParsedCsvRow = {
  rowNumber: number;
  values: string[];
  columns: Record<string, string>;
  rawRow: Record<string, string>;
  hasColumnCountMismatch: boolean;
};

export type ParsedCsv = {
  headers: string[];
  rows: ParsedCsvRow[];
};

export class UnsupportedCsvDelimiterError extends Error {
  readonly code = VIP_IMPORT_UNSUPPORTED_DELIMITER_CODE;
  readonly metadata: UnsupportedCsvDelimiterMetadata;

  constructor(metadata: UnsupportedCsvDelimiterMetadata) {
    super(
      `VIP CSV imports only support comma-delimited CSV; detected ${metadata.detectedDelimiterName} delimiter`,
    );
    this.name = 'UnsupportedCsvDelimiterError';
    this.metadata = metadata;
  }
}

export function parseCsv(content: string): ParsedCsv {
  assertSupportedCsvDelimiter(content);

  const records = parseCsvRecords(content);

  if (records.length === 0) {
    return { headers: [], rows: [] };
  }

  const headers = records[0].map(normalizeHeader);
  const rows = records.slice(1).flatMap((values, index) => {
    if (values.every((value) => value.trim() === '')) {
      return [];
    }

    const columns: Record<string, string> = {};
    const rawRow: Record<string, string> = {};

    headers.forEach((header, headerIndex) => {
      columns[header] = values[headerIndex]?.trim() ?? '';
      rawRow[header] = values[headerIndex] ?? '';
    });

    return [
      {
        rowNumber: index + 2,
        values,
        columns,
        rawRow,
        hasColumnCountMismatch: values.length !== headers.length,
      },
    ];
  });

  return { headers, rows };
}

export function assertSupportedCsvDelimiter(content: string): void {
  const unsupportedDelimiter = detectUnsupportedCsvDelimiter(content);

  if (!unsupportedDelimiter) {
    return;
  }

  throw new UnsupportedCsvDelimiterError({
    detectedDelimiter: unsupportedDelimiter.delimiter,
    detectedDelimiterName: unsupportedDelimiter.name,
    supportedDelimiter: VIP_IMPORT_CSV_DELIMITER,
  });
}

export function normalizeHeader(value: string): string {
  return value
    .replace(/^\uFEFF/, '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

export function getCsvValue(row: ParsedCsvRow, header: string): string | null {
  const value = row.columns[header]?.trim();

  return value ? value : null;
}

export function normalizeName(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toLowerCase();
}

export function normalizeEmail(value: string | null): string | null {
  if (!value) {
    return null;
  }

  return value.trim().toLowerCase();
}

export function normalizePhone(value: string | null): string | null {
  if (!value) {
    return null;
  }

  const normalized = value.replace(/[^0-9+]/g, '');

  return normalized ? normalized : null;
}

export function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function sha256(value: string | Buffer): string {
  return createHash('sha256').update(value).digest('hex');
}

export function buildIdentityKey(input: {
  normalizedEmail: string | null;
  normalizedPhone: string | null;
  normalizedFullName: string;
}): string {
  return sha256(
    [input.normalizedEmail ?? '', input.normalizedPhone ?? '', input.normalizedFullName].join('|'),
  );
}

export function buildVipQrHash(input: {
  concertId: string;
  sponsorSource: string;
  externalGuestKey: string | null;
  normalizedIdentityKey: string | null;
}): string {
  return sha256(
    [
      'vip',
      input.concertId,
      input.sponsorSource,
      input.externalGuestKey ?? input.normalizedIdentityKey ?? '',
    ].join(':'),
  );
}

function detectUnsupportedCsvDelimiter(content: string): AlternateCsvDelimiter | null {
  const headerRecord = getFirstCsvRecord(content);

  if (!headerRecord.trim()) {
    return null;
  }

  const delimiterCounts = countUnquotedDelimiters(headerRecord);
  const alternateDelimiter = ALTERNATE_CSV_DELIMITERS.map((candidate) => ({
    ...candidate,
    count: delimiterCounts.get(candidate.delimiter) ?? 0,
  }))
    .filter((candidate) => candidate.count > 0)
    .sort((left, right) => right.count - left.count)[0];

  return alternateDelimiter ?? null;
}

function getFirstCsvRecord(content: string): string {
  let inQuotes = false;

  for (let index = 0; index < content.length; index += 1) {
    const character = content[index];

    if (character === '"') {
      if (inQuotes && content[index + 1] === '"') {
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if ((character === '\n' || character === '\r') && !inQuotes) {
      return content.slice(0, index);
    }
  }

  return content;
}

function countUnquotedDelimiters(record: string): Map<string, number> {
  const delimiters = [VIP_IMPORT_CSV_DELIMITER, ...ALTERNATE_CSV_DELIMITERS.map((candidate) => candidate.delimiter)];
  const counts = new Map(delimiters.map((delimiter) => [delimiter, 0]));
  let inQuotes = false;

  for (let index = 0; index < record.length; index += 1) {
    const character = record[index];

    if (character === '"') {
      if (inQuotes && record[index + 1] === '"') {
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (!inQuotes && counts.has(character)) {
      counts.set(character, (counts.get(character) ?? 0) + 1);
    }
  }

  return counts;
}

function parseCsvRecords(content: string, delimiter = VIP_IMPORT_CSV_DELIMITER): string[][] {
  const records: string[][] = [];
  let record: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let index = 0; index < content.length; index += 1) {
    const character = content[index];

    if (character === '"') {
      if (inQuotes && content[index + 1] === '"') {
        field += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (character === delimiter && !inQuotes) {
      record.push(field);
      field = '';
      continue;
    }

    if ((character === '\n' || character === '\r') && !inQuotes) {
      if (character === '\r' && content[index + 1] === '\n') {
        index += 1;
      }

      record.push(field);
      records.push(record);
      record = [];
      field = '';
      continue;
    }

    field += character;
  }

  if (field.length > 0 || record.length > 0) {
    record.push(field);
    records.push(record);
  }

  return records;
}
