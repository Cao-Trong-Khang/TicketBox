import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { GateStaffAssignmentController } from './gate-staff-assignment.controller';
import { GateStaffAssignmentService } from './gate-staff-assignment.service';

@Module({
  imports: [PrismaModule],
  controllers: [GateStaffAssignmentController],
  providers: [GateStaffAssignmentService],
  exports: [GateStaffAssignmentService],
})
export class GateStaffAssignmentModule {}
