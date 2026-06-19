import { Body, Controller, Delete, Get, HttpCode, Param, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AuthenticatedUser } from '../auth/types';
import { AssignRoleDto } from './dto/assign-role.dto';
import { ROLE_CODES } from './rbac.constants';
import { RbacService } from './rbac.service';
import { Roles } from './roles.decorator';
import { RolesGuard } from './roles.guard';

type AuthenticatedRequest = {
  user: AuthenticatedUser;
};

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller()
export class RbacController {
  constructor(private readonly rbacService: RbacService) {}

  @Get('roles')
  listRoles() {
    return this.rbacService.listRoles();
  }

  @Roles(ROLE_CODES.organizer)
  @Get('admin/users/:userId/roles')
  getUserRoles(@Param('userId') userId: string) {
    return this.rbacService.getUserRoles(userId);
  }

  @Roles(ROLE_CODES.organizer)
  @Post('admin/users/:userId/roles')
  assignUserRole(
    @Req() request: AuthenticatedRequest,
    @Param('userId') userId: string,
    @Body() dto: AssignRoleDto,
  ) {
    return this.rbacService.assignUserRole(request.user.id, userId, dto.role_code);
  }

  @Roles(ROLE_CODES.organizer)
  @Delete('admin/users/:userId/roles/:roleCode')
  @HttpCode(204)
  removeUserRole(
    @Req() request: AuthenticatedRequest,
    @Param('userId') userId: string,
    @Param('roleCode') roleCode: string,
  ) {
    return this.rbacService.removeUserRole(request.user.id, userId, roleCode);
  }
}
