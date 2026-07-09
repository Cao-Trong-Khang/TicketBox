import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AuthenticatedUser } from '../auth/types';
import { TicketsService, type MyTicketDto } from './tickets.service';

type AuthenticatedRequest = {
  user: AuthenticatedUser;
};

@Controller('tickets')
@UseGuards(JwtAuthGuard)
export class TicketsController {
  constructor(private readonly ticketsService: TicketsService) {}

  @Get('me')
  listMyTickets(@Req() request: AuthenticatedRequest): Promise<MyTicketDto[]> {
    return this.ticketsService.listMyTickets(request.user);
  }
}
