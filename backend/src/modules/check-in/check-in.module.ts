import { Module } from '@nestjs/common';
import { AuditLogModule } from '../audit/audit-log.module';
import { PrismaModule } from '../../prisma/prisma.module';
import { CheckInController } from './check-in.controller';
import { CheckInEventsPublisher } from './check-in-events.publisher';
import { CHECK_IN_NOW, CheckInService } from './check-in.service';
import { CheckInStaffAssignmentController } from './check-in-staff-assignment.controller';
import { CheckInStaffAssignmentService } from './check-in-staff-assignment.service';

@Module({
  imports: [AuditLogModule, PrismaModule],
  controllers: [CheckInController, CheckInStaffAssignmentController],
  providers: [
    CheckInService,
    CheckInEventsPublisher,
    CheckInStaffAssignmentService,
    {
      provide: CHECK_IN_NOW,
      useValue: () => new Date(),
    },
  ],
  exports: [CheckInService, CheckInStaffAssignmentService],
})
export class CheckInModule {}
