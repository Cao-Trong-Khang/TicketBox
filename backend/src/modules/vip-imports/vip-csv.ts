import { createHash } from 'node:crypto';
import { TextDecoder } from 'node:util';

export const VIP_IMPORT_REQUIRED_COLUMNS = ['full_name'] as const;
export const VIP_IMPORT_IDENTITY_COLUMNS = ['external_guest_key', 'email', 'phone'] as const;
export const VIP_IMPORT_SUPPORTED_COLUMNS = [
  'concert_id',
  'concert_title',
  'sponsor_source',
  'external_guest_key',
  'full_name',
  'email',
  'phone',
  'sponsor_company',
  'company',
  'invited_by',
  'guest_type',
  'allowed_gate',
  'notes',
] as const;
export type VipImportSupportedColumn = (typeof VIP_IMPORT_SUPPORTED_COLUMNS)[number];

export const VIP_IMPORT_CSV_DELIMITER = ',';
export const VIP_IMPORT_UNSUPPORTED_DELIMITER_CODE = 'UNSUPPORTED_DELIMITER';
export const VIP_IMPORT_INVALID_ENCODING_CODE = 'INVALID_ENCODING';
export const VIP_IMPORT_MALFORMED_CSV_CODE = 'MALFORMED_CSV';
export const VIP_IMPORT_REQUIRED_ENCODING = 'UTF-8';
export const VIP_IMPORT_FIELD_LIMITS: Partial<Record<VipImportSupportedColumn, number>> = {
  concert_id: 64,
  concert_title: 256,
  sponsor_source: 64,
  external_guest_key: 64,
  full_name: 128,
  email: 254,
  phone: 32,
  sponsor_company: 128,
  company: 128,
  invited_by: 128,
  guest_type: 64,
  allowed_gate: 64,
  notes: 1000,
};

type AlternateCsvDelimiter = {
  delimiter: string;
  name: string;
};

type UnsupportedCsvDelimiterMetadata = {
  detectedDelimiter: string;
  detectedDelimiterName: string;
  supportedDelimiter: string;
};

type InvalidCsvEncodingMetadata = {
  requiredEncoding: string;
};

type MalformedCsvMetadata = {
  rowNumber: number;
  columnNumber: number;
  reason: string;
};

const ALTERNATE_CSV_DELIMITERS: AlternateCsvDelimiter[] = [
  { delimiter: ';', name: 'semicolon (;)' },
  { delimiter: '\t', name: 'tab (\\t)' },
  { delimiter: '|', name: 'pipe (|)' },
];
const UTF8_DECODER = new TextDecoder('utf-8', { fatal: true });

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

export class InvalidCsvEncodingError extends Error {
  readonly code = VIP_IMPORT_INVALID_ENCODING_CODE;
  readonly metadata: InvalidCsvEncodingMetadata = {
    requiredEncoding: VIP_IMPORT_REQUIRED_ENCODING,
  };

  constructor() {
    super(`VIP CSV imports must be encoded as valid ${VIP_IMPORT_REQUIRED_ENCODING}`);
    this.name = 'InvalidCsvEncodingError';
  }
}

export class MalformedCsvError extends Error {
  readonly code = VIP_IMPORT_MALFORMED_CSV_CODE;
  readonly metadata: MalformedCsvMetadata;

  constructor(metadata: MalformedCsvMetadata) {
    super(
      `Malformed VIP CSV at row ${metadata.rowNumber}, column ${metadata.columnNumber}: ${metadata.reason}`,
    );
    this.name = 'MalformedCsvError';
    this.metadata = metadata;
  }
}

export function decodeVipCsvContent(buffer: Buffer): string {
  try {
    return UTF8_DECODER.decode(buffer);
  } catch {
    throw new InvalidCsvEncodingError();
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

  const normalized = value.trim().replace(/[\s().-]/g, '');

  return normalized ? normalized : null;
}

export function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function isValidPhone(value: string): boolean {
  const normalized = normalizePhone(value);

  return normalized ? /^\+?[0-9]{8,15}$/.test(normalized) : false;
}

export function isValidExternalGuestKey(value: string): boolean {
  return /^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$/.test(value.trim());
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
  let afterClosingQuote = false;
  let quotedFieldStartIndex: number | null = null;

  const pushField = () => {
    record.push(field);
    field = '';
    inQuotes = false;
    afterClosingQuote = false;
    quotedFieldStartIndex = null;
  };

  const pushRecord = () => {
    pushField();
    records.push(record);
    record = [];
  };

  for (let index = 0; index < content.length; index += 1) {
    const character = content[index];

    if (inQuotes) {
      if (character === '"') {
        if (content[index + 1] === '"') {
          field += '"';
          index += 1;
        } else {
          inQuotes = false;
          afterClosingQuote = true;
        }
        continue;
      }

      field += character;
      continue;
    }

    if (afterClosingQuote) {
      if (character === delimiter) {
        pushField();
        continue;
      }

      if ((character === '\n' || character === '\r')) {
        if (character === '\r' && content[index + 1] === '\n') {
          index += 1;
        }

        pushRecord();
        continue;
      }

      if (character === ' ' || character === '\t') {
        continue;
      }

      throwMalformedCsvError(content, index, 'Unexpected character after closing quote');
    }

    if (character === '"') {
      if (field.length > 0) {
        throwMalformedCsvError(content, index, 'Unexpected quote in unquoted field');
      }

      inQuotes = true;
      quotedFieldStartIndex = index;
      continue;
    }

    if (character === delimiter) {
      pushField();
      continue;
    }

    if ((character === '\n' || character === '\r')) {
      if (character === '\r' && content[index + 1] === '\n') {
        index += 1;
      }
      pushRecord();
      continue;
    }

    field += character;
  }

  if (inQuotes) {
    throwMalformedCsvError(
      content,
      quotedFieldStartIndex ?? content.length,
      'Unclosed quoted field',
    );
  }

  if (afterClosingQuote || field.length > 0 || record.length > 0) {
    pushField();
    records.push(record);
  }

  return records;
}

function throwMalformedCsvError(content: string, index: number, reason: string): never {
  const position = getCsvPosition(content, index);

  throw new MalformedCsvError({
    rowNumber: position.rowNumber,
    columnNumber: position.columnNumber,
    reason,
  });
}

function getCsvPosition(content: string, targetIndex: number): {
  rowNumber: number;
  columnNumber: number;
} {
  let rowNumber = 1;
  let columnNumber = 1;

  for (let index = 0; index < targetIndex; index += 1) {
    const character = content[index];

    if (character === '\r') {
      if (content[index + 1] === '\n') {
        index += 1;
      }

      rowNumber += 1;
      columnNumber = 1;
      continue;
    }

    if (character === '\n') {
      rowNumber += 1;
      columnNumber = 1;
      continue;
    }

    columnNumber += 1;
  }

  return { rowNumber, columnNumber };
}
