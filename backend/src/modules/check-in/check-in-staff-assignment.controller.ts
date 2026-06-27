import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthenticatedUser } from '../auth/types';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Permissions } from '../rbac/permissions.decorator';
import { PermissionsGuard } from '../rbac/permissions.guard';
import { PERMISSION_CODES } from '../rbac/rbac.constants';
import { AssignCheckInStaffDto } from './dto/assign-check-in-staff.dto';
import { CheckInStaffAssignmentService } from './check-in-staff-assignment.service';

type AuthenticatedRequest = {
  user: AuthenticatedUser;
};

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Permissions(PERMISSION_CODES.concertUpdate)
@Controller('admin/concerts/:concertId/check-in-staff')
export class CheckInStaffAssignmentController {
  constructor(private readonly assignmentService: CheckInStaffAssignmentService) {}

  @Post()
  assignStaff(
    @Req() request: AuthenticatedRequest,
    @Param('concertId') concertId: string,
    @Body() dto: AssignCheckInStaffDto,
  ) {
    return this.assignmentService.assignStaff(
      request.user.id,
      concertId,
      dto.user_id,
      dto.gate_label,
    );
  }

  @Get()
  listStaff(@Req() request: AuthenticatedRequest, @Param('concertId') concertId: string) {
    return this.assignmentService.listStaff(request.user.id, concertId);
  }

  @Delete(':assignmentId')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeStaff(
    @Req() request: AuthenticatedRequest,
    @Param('concertId') concertId: string,
    @Param('assignmentId') assignmentId: string,
  ): Promise<void> {
    return this.assignmentService.removeStaff(request.user.id, concertId, assignmentId);
  }
}