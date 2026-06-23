import assert from 'node:assert/strict';
import test from 'node:test';
import {
  InvalidCsvEncodingError,
  UnsupportedCsvDelimiterError,
  VIP_IMPORT_INVALID_ENCODING_CODE,
  VIP_IMPORT_UNSUPPORTED_DELIMITER_CODE,
  decodeVipCsvContent,
  parseCsv,
} from './vip-csv';

test('decodeVipCsvContent accepts valid UTF-8 CSV content', () => {
  const content = decodeVipCsvContent(
    Buffer.from(
      [
        'concert_title,sponsor_source,external_guest_key,full_name,email',
        'Demo Concert,LOCAL_DEMO,VIP-001,Nguyen Van A,nguyen@example.test',
        'Demo Concert,LOCAL_DEMO,VIP-002,Nguyen Thi B,nguyenb@example.test',
      ].join('\n'),
      'utf8',
    ),
  );

  assert.match(content, /Nguyen Van A/);
});

test('decodeVipCsvContent rejects invalid UTF-8 bytes', () => {
  const invalidWindows1258LikeBytes = Buffer.concat([
    Buffer.from(
      [
        'concert_title,sponsor_source,external_guest_key,full_name,email',
        'Demo Concert,LOCAL_DEMO,VIP-001,Nguy',
      ].join('\n'),
      'utf8',
    ),
    Buffer.from([0xea]),
    Buffer.from('n Van A,nguyen@example.test', 'utf8'),
  ]);

  assert.throws(
    () => decodeVipCsvContent(invalidWindows1258LikeBytes),
    (error) =>
      error instanceof InvalidCsvEncodingError &&
      error.code === VIP_IMPORT_INVALID_ENCODING_CODE &&
      error.metadata.requiredEncoding === 'UTF-8',
  );
});

test('parseCsv accepts comma-delimited VIP CSV content', () => {
  const parsed = parseCsv(
    [
      'concert_title,sponsor_source,external_guest_key,full_name,email',
      'Demo Concert,LOCAL_DEMO,VIP-001,Demo Guest,demo@example.test',
    ].join('\n'),
  );

  assert.deepEqual(parsed.headers, [
    'concert_title',
    'sponsor_source',
    'external_guest_key',
    'full_name',
    'email',
  ]);
  assert.equal(parsed.rows.length, 1);
  assert.equal(parsed.rows[0].columns.full_name, 'Demo Guest');
});

test('parseCsv rejects alternate delimiters instead of parsing them silently', () => {
  const cases = [
    { delimiter: ';', name: 'semicolon (;)' },
    { delimiter: '\t', name: 'tab (\\t)' },
    { delimiter: '|', name: 'pipe (|)' },
  ];

  for (const testCase of cases) {
    assert.throws(
      () =>
        parseCsv(
          [
            ['concert_title', 'sponsor_source', 'external_guest_key', 'full_name', 'email'].join(
              testCase.delimiter,
            ),
            ['Demo Concert', 'LOCAL_DEMO', 'VIP-001', 'Demo Guest', 'demo@example.test'].join(
              testCase.delimiter,
            ),
          ].join('\n'),
        ),
      (error) =>
        error instanceof UnsupportedCsvDelimiterError &&
        error.code === VIP_IMPORT_UNSUPPORTED_DELIMITER_CODE &&
        error.metadata.detectedDelimiter === testCase.delimiter &&
        error.metadata.detectedDelimiterName === testCase.name,
    );
  }
});
