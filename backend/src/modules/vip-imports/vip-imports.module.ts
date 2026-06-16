import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { VipImportJobsPublisher } from './vip-import-jobs.publisher';
import { VipImportReportService } from './vip-import-report.service';
import { VipImportSchedulerService } from './vip-import-scheduler.service';
import { VipImportWorkerService } from './vip-import-worker.service';
import { VipImportsController } from './vip-imports.controller';

@Module({
  imports: [PrismaModule],
  controllers: [VipImportsController],
  providers: [
    VipImportJobsPublisher,
    VipImportReportService,
    VipImportSchedulerService,
    VipImportWorkerService,
  ],
  exports: [VipImportSchedulerService, VipImportWorkerService, VipImportReportService],
})
export class VipImportsModule {}
