import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Permissions } from './permissions.decorator';
import { PermissionsGuard } from './permissions.guard';
import { PERMISSION_CODES } from './rbac.constants';

@Controller('rbac-test')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class RbacTestController {
  @Get('concert-create')
  @Permissions(PERMISSION_CODES.concertCreate)
  concertCreate() {
    return { ok: true, permission: PERMISSION_CODES.concertCreate };
  }

  @Get('ticket-purchase')
  @Permissions(PERMISSION_CODES.ticketPurchase)
  ticketPurchase() {
    return { ok: true, permission: PERMISSION_CODES.ticketPurchase };
  }
}
