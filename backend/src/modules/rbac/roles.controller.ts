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
import { AssignRoleDto } from './dto/assign-role.dto';
import { PERMISSION_CODES } from './rbac.constants';
import { Permissions } from './permissions.decorator';
import { PermissionsGuard } from './permissions.guard';
import { RoleManagementService } from './role-management.service';

type AuthenticatedRequest = {
  user: AuthenticatedUser;
};

@Controller()
export class RolesController {
  constructor(private readonly roleManagementService: RoleManagementService) {}

  @UseGuards(JwtAuthGuard)
  @Get('roles')
  listRoles() {
    return this.roleManagementService.listRoles();
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions(PERMISSION_CODES.concertUpdate)
  @Get('admin/users/:userId/roles')
  listUserRoles(@Param('userId') userId: string) {
    return this.roleManagementService.listUserRoles(userId);
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions(PERMISSION_CODES.concertUpdate)
  @Post('admin/users/:userId/roles')
  assignRole(
    @Req() request: AuthenticatedRequest,
    @Param('userId') userId: string,
    @Body() dto: AssignRoleDto,
  ) {
    return this.roleManagementService.assignRole(request.user.id, userId, dto.role_code);
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions(PERMISSION_CODES.concertUpdate)
  @Delete('admin/users/:userId/roles/:roleCode')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeRole(
    @Req() request: AuthenticatedRequest,
    @Param('userId') userId: string,
    @Param('roleCode') roleCode: string,
  ): Promise<void> {
    return this.roleManagementService.removeRole(request.user.id, userId, roleCode);
  }
}