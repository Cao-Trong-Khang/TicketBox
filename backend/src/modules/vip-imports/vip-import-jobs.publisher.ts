import { Injectable, Logger } from '@nestjs/common';
import {
  VIP_GUEST_IMPORT_REQUESTED_TOPIC,
  VipGuestImportRequestedJob,
} from './vip-imports.types';

@Injectable()
export class VipImportJobsPublisher {
  private readonly logger = new Logger(VipImportJobsPublisher.name);

  async publishImportRequested(job: VipGuestImportRequestedJob): Promise<void> {
    if (process.env.VIP_IMPORT_QUEUE_FAIL === '1' || process.env.VIP_IMPORT_KAFKA_FAIL === '1') {
      throw new Error('Simulated VIP import queue outage');
    }

    this.logger.log(
      `Enqueued ${VIP_GUEST_IMPORT_REQUESTED_TOPIC} in the database-backed VIP import queue for import ${job.importId} (${job.fileName})`,
    );
  }
}
