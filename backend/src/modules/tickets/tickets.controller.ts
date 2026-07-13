import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AuthenticatedUser } from '../auth/types';
import { Permissions } from '../rbac/permissions.decorator';
import { PermissionsGuard } from '../rbac/permissions.guard';
import { PERMISSION_CODES } from '../rbac/rbac.constants';
import { TicketsService, type MyTicketDto } from './tickets.service';

type AuthenticatedRequest = {
  user: AuthenticatedUser;
};

@Controller('tickets')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class TicketsController {
  constructor(private readonly ticketsService: TicketsService) {}

  @Get('me')
  @Permissions(PERMISSION_CODES.ticketReadOwn)
  listMyTickets(@Req() request: AuthenticatedRequest): Promise<MyTicketDto[]> {
    return this.ticketsService.listMyTickets(request.user);
  }
}
