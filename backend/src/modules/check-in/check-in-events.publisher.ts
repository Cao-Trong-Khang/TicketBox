import { Injectable } from '@nestjs/common';
import { CheckIn } from '@prisma/client';

@Injectable()
export class CheckInEventsPublisher {
  async publishSyncOutcome(checkIn: CheckIn): Promise<void> {
    void checkIn;

    if (process.env.CHECKIN_KAFKA_FAIL === '1') {
      throw new Error('Simulated Kafka outage');
    }
  }
}
