import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Req, UseGuards } from '@nestjs/common';
import { AuthenticatedUser } from '../auth/types';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Permissions } from '../rbac/permissions.decorator';
import { PermissionsGuard } from '../rbac/permissions.guard';
import { PERMISSION_CODES } from '../rbac/rbac.constants';
import { CheckInService } from './check-in.service';
import {
  CheckInAssignmentDto,
  CheckInPreloadDto,
  CheckInSyncResponseDto,
} from './check-in.types';
import { SyncCheckInDto } from './dto/sync-check-in.dto';

type AuthenticatedRequest = {
  user: AuthenticatedUser;
};

@Controller('check-in')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class CheckInController {
  constructor(private readonly checkInService: CheckInService) {}

  @Get('assignments')
  @Permissions(PERMISSION_CODES.checkinPreload)
  listAssignments(@Req() request: AuthenticatedRequest): Promise<CheckInAssignmentDto[]> {
    return this.checkInService.listAssignments(request.user);
  }

  @Get('events/:concertId/preload')
  @Permissions(PERMISSION_CODES.checkinPreload)
  preloadEvent(
    @Req() request: AuthenticatedRequest,
    @Param('concertId', new ParseUUIDPipe({ version: '4' })) concertId: string,
  ): Promise<CheckInPreloadDto> {
    return this.checkInService.preloadEvent(request.user, concertId);
  }

  @Post('events/:concertId/sync')
  @Permissions(PERMISSION_CODES.checkinScan, PERMISSION_CODES.checkinSync)
  syncEvent(
    @Req() request: AuthenticatedRequest,
    @Param('concertId', new ParseUUIDPipe({ version: '4' })) concertId: string,
    @Body() dto: SyncCheckInDto,
  ): Promise<CheckInSyncResponseDto> {
    return this.checkInService.syncEvent(request.user, concertId, dto);
  }
}
