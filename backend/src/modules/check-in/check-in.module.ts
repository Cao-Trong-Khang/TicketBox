import { Module } from '@nestjs/common';
import { AuditLogModule } from '../audit/audit-log.module';
import { PrismaModule } from '../../prisma/prisma.module';
import { CheckInController } from './check-in.controller';
import { CheckInEventsPublisher } from './check-in-events.publisher';
import { CheckInStaffAssignmentController } from './check-in-staff-assignment.controller';
import { CheckInStaffAssignmentService } from './check-in-staff-assignment.service';
import { CheckInService } from './check-in.service';

@Module({
  imports: [AuditLogModule, PrismaModule],
  controllers: [CheckInController, CheckInStaffAssignmentController],
  providers: [CheckInService, CheckInEventsPublisher, CheckInStaffAssignmentService],
  exports: [CheckInService, CheckInStaffAssignmentService],
})
export class CheckInModule {}
