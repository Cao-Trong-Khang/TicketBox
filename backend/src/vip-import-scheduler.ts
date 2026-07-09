import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { VipImportSchedulerService } from './modules/vip-imports/vip-import-scheduler.service';

async function bootstrapScheduler() {
  const app = await NestFactory.createApplicationContext(AppModule);

  try {
    const scheduler = app.get(VipImportSchedulerService);
    const result = await scheduler.scanScheduledImports(process.argv[2]);

    console.log(JSON.stringify(result, null, 2));
  } finally {
    await app.close();
  }
}

void bootstrapScheduler();
