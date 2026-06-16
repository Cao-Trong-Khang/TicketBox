import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { CheckInController } from './check-in.controller';
import { CheckInEventsPublisher } from './check-in-events.publisher';
import { CheckInService } from './check-in.service';

@Module({
  imports: [PrismaModule],
  controllers: [CheckInController],
  providers: [CheckInService, CheckInEventsPublisher],
  exports: [CheckInService],
})
export class CheckInModule {}
