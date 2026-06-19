import { Body, Controller, Delete, Get, HttpCode, Param, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AuthenticatedUser } from '../auth/types';
import { ROLE_CODES } from '../rbac/rbac.constants';
import { Roles } from '../rbac/roles.decorator';
import { RolesGuard } from '../rbac/roles.guard';
import { CreateGateStaffAssignmentDto } from './dto/create-gate-staff-assignment.dto';
import { GateStaffAssignmentService } from './gate-staff-assignment.service';

type AuthenticatedRequest = {
  user: AuthenticatedUser;
};

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(ROLE_CODES.organizer)
@Controller('admin/concerts/:concertId/gate-staff')
export class GateStaffAssignmentController {
  constructor(private readonly gateStaffAssignmentService: GateStaffAssignmentService) {}

  @Post()
  create(
    @Req() request: AuthenticatedRequest,
    @Param('concertId') concertId: string,
    @Body() dto: CreateGateStaffAssignmentDto,
  ) {
    return this.gateStaffAssignmentService.createAssignment(request.user.id, concertId, dto);
  }

  @Get()
  list(@Req() request: AuthenticatedRequest, @Param('concertId') concertId: string) {
    return this.gateStaffAssignmentService.listAssignments(request.user.id, concertId);
  }

  @Delete(':assignmentId')
  @HttpCode(204)
  delete(
    @Req() request: AuthenticatedRequest,
    @Param('concertId') concertId: string,
    @Param('assignmentId') assignmentId: string,
  ) {
    return this.gateStaffAssignmentService.deleteAssignment(request.user.id, concertId, assignmentId);
  }
}
