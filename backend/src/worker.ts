import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { VipImportSchedulerService } from './modules/vip-imports/vip-import-scheduler.service';
import { VipImportWorkerService } from './modules/vip-imports/vip-import-worker.service';

const DEFAULT_SCAN_INTERVAL_MS = 60_000;
const DEFAULT_WORKER_POLL_INTERVAL_MS = 10_000;
const DEFAULT_WORKER_BATCH_LIMIT = 10;
const DEFAULT_ERROR_BACKOFF_MS = 15_000;

type WorkerOptions = {
  once: boolean;
  noScan: boolean;
  importId: string | null;
  sourceDir: string | undefined;
  scanIntervalMs: number;
  workerPollIntervalMs: number;
  batchLimit: number;
};

async function bootstrapWorker() {
  const app = await NestFactory.createApplicationContext(AppModule);

  try {
    const scheduler = app.get(VipImportSchedulerService);
    const worker = app.get(VipImportWorkerService);
    const options = parseWorkerOptions(process.argv.slice(2));

    if (options.importId) {
      const result = await worker.processImport(options.importId);
      console.log(JSON.stringify(result, null, 2));
      return;
    }

    if (options.once) {
      const scan = options.noScan
        ? null
        : await scheduler.scanScheduledImports(options.sourceDir);
      const results = await worker.processPendingImports(options.batchLimit);
      console.log(JSON.stringify({ scan, results }, null, 2));
      return;
    }

    await runDaemon(scheduler, worker, options);
  } finally {
    await app.close();
  }
}

async function runDaemon(
  scheduler: VipImportSchedulerService,
  worker: VipImportWorkerService,
  options: WorkerOptions,
): Promise<void> {
  let shutdownRequested = false;
  const requestShutdown = () => {
    shutdownRequested = true;
  };

  process.once('SIGINT', requestShutdown);
  process.once('SIGTERM', requestShutdown);

  console.log(
    JSON.stringify(
      {
        message: 'VIP import worker daemon started',
        sourceDir: options.sourceDir ?? process.env.VIP_CSV_SOURCE_DIR ?? null,
        scanIntervalMs: options.scanIntervalMs,
        workerPollIntervalMs: options.workerPollIntervalMs,
        batchLimit: options.batchLimit,
      },
      null,
      2,
    ),
  );

  let nextScanAt = 0;

  while (!shutdownRequested) {
    try {
      const now = Date.now();

      if (!options.noScan && now >= nextScanAt) {
        const scan = await scheduler.scanScheduledImports(options.sourceDir);

        if (scan.detected > 0 || scan.queued > 0 || scan.failedToEnqueue > 0) {
          console.log(JSON.stringify({ scan }, null, 2));
        }

        nextScanAt = Date.now() + options.scanIntervalMs;
      }

      const results = await worker.processPendingImports(options.batchLimit);

      if (results.length > 0) {
        console.log(JSON.stringify({ results }, null, 2));
      }

      await sleep(options.workerPollIntervalMs);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown VIP import worker error';
      console.error(JSON.stringify({ message }, null, 2));
      await sleep(DEFAULT_ERROR_BACKOFF_MS);
    }
  }

  process.off('SIGINT', requestShutdown);
  process.off('SIGTERM', requestShutdown);
}

function parseWorkerOptions(args: string[]): WorkerOptions {
  const options: WorkerOptions = {
    once: false,
    noScan: false,
    importId: null,
    sourceDir: undefined,
    scanIntervalMs: readPositiveIntegerEnv(
      'VIP_IMPORT_SCAN_INTERVAL_MS',
      DEFAULT_SCAN_INTERVAL_MS,
    ),
    workerPollIntervalMs: readPositiveIntegerEnv(
      'VIP_IMPORT_WORKER_POLL_INTERVAL_MS',
      DEFAULT_WORKER_POLL_INTERVAL_MS,
    ),
    batchLimit: readPositiveIntegerEnv(
      'VIP_IMPORT_WORKER_BATCH_LIMIT',
      DEFAULT_WORKER_BATCH_LIMIT,
    ),
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === '--once') {
      options.once = true;
      continue;
    }

    if (arg === '--no-scan') {
      options.noScan = true;
      continue;
    }

    if (arg === '--source-dir') {
      options.sourceDir = args[index + 1];
      index += 1;
      continue;
    }

    if (arg.startsWith('--source-dir=')) {
      options.sourceDir = arg.slice('--source-dir='.length);
      continue;
    }

    if (arg === '--scan-interval-ms') {
      options.scanIntervalMs = readPositiveInteger(args[index + 1], options.scanIntervalMs);
      index += 1;
      continue;
    }

    if (arg.startsWith('--scan-interval-ms=')) {
      options.scanIntervalMs = readPositiveInteger(
        arg.slice('--scan-interval-ms='.length),
        options.scanIntervalMs,
      );
      continue;
    }

    if (arg === '--worker-poll-interval-ms') {
      options.workerPollIntervalMs = readPositiveInteger(
        args[index + 1],
        options.workerPollIntervalMs,
      );
      index += 1;
      continue;
    }

    if (arg.startsWith('--worker-poll-interval-ms=')) {
      options.workerPollIntervalMs = readPositiveInteger(
        arg.slice('--worker-poll-interval-ms='.length),
        options.workerPollIntervalMs,
      );
      continue;
    }

    if (arg === '--batch-limit') {
      options.batchLimit = readPositiveInteger(args[index + 1], options.batchLimit);
      index += 1;
      continue;
    }

    if (arg.startsWith('--batch-limit=')) {
      options.batchLimit = readPositiveInteger(
        arg.slice('--batch-limit='.length),
        options.batchLimit,
      );
      continue;
    }

    if (!arg.startsWith('-') && !options.importId) {
      options.importId = arg;
    }
  }

  return options;
}

function readPositiveIntegerEnv(name: string, fallback: number): number {
  return readPositiveInteger(process.env[name], fallback);
}

function readPositiveInteger(value: string | undefined, fallback: number): number {
  const parsed = Number(value);

  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

void bootstrapWorker();
