import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { VipImportWorkerService } from './modules/vip-imports/vip-import-worker.service';

async function bootstrapWorker() {
  const app = await NestFactory.createApplicationContext(AppModule);

  try {
    const worker = app.get(VipImportWorkerService);
    const importId = process.argv[2];

    if (importId) {
      const result = await worker.processImport(importId);
      console.log(JSON.stringify(result, null, 2));
      return;
    }

    const results = await worker.processPendingImports();
    console.log(JSON.stringify(results, null, 2));
  } finally {
    await app.close();
  }
}

void bootstrapWorker();
