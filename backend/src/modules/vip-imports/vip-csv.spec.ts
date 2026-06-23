import assert from 'node:assert/strict';
import test from 'node:test';
import {
  UnsupportedCsvDelimiterError,
  VIP_IMPORT_UNSUPPORTED_DELIMITER_CODE,
  parseCsv,
} from './vip-csv';

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
