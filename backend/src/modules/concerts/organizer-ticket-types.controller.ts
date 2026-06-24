import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { AuthenticatedUser } from "../auth/types";
import { OrganizerTicketTypeCreateDto } from "./dto/organizer-ticket-type-create.dto";
import { OrganizerTicketTypeDto } from "./dto/organizer-ticket-type.dto";
import { OrganizerTicketTypeUpdateDto } from "./dto/organizer-ticket-type-update.dto";
import { OrganizerTicketTypesService } from "./organizer-ticket-types.service";

type AuthenticatedRequest = {
  user: AuthenticatedUser;
};

@Controller("organizer/concerts/:concertId/ticket-types")
@UseGuards(JwtAuthGuard)
export class OrganizerTicketTypesController {
  constructor(
    private readonly organizerTicketTypesService: OrganizerTicketTypesService,
  ) {}

  @Get()
  listTicketTypes(
    @Req() request: AuthenticatedRequest,
    @Param("concertId", new ParseUUIDPipe({ version: "4" })) concertId: string,
  ): Promise<OrganizerTicketTypeDto[]> {
    return this.organizerTicketTypesService.listOwnedConcertTicketTypes(
      request.user.id,
      concertId,
    );
  }

  @Post()
  createTicketType(
    @Req() request: AuthenticatedRequest,
    @Param("concertId", new ParseUUIDPipe({ version: "4" })) concertId: string,
    @Body() dto: OrganizerTicketTypeCreateDto,
  ): Promise<OrganizerTicketTypeDto> {
    return this.organizerTicketTypesService.createOwnedConcertTicketType(
      request.user.id,
      concertId,
      dto,
    );
  }

  @Patch(":ticketTypeId")
  updateTicketType(
    @Req() request: AuthenticatedRequest,
    @Param("concertId", new ParseUUIDPipe({ version: "4" })) concertId: string,
    @Param("ticketTypeId", new ParseUUIDPipe({ version: "4" }))
    ticketTypeId: string,
    @Body() dto: OrganizerTicketTypeUpdateDto,
  ): Promise<OrganizerTicketTypeDto> {
    return this.organizerTicketTypesService.updateOwnedConcertTicketType(
      request.user.id,
      concertId,
      ticketTypeId,
      dto,
    );
  }

  @Post(":ticketTypeId/activate")
  activateTicketType(
    @Req() request: AuthenticatedRequest,
    @Param("concertId", new ParseUUIDPipe({ version: "4" })) concertId: string,
    @Param("ticketTypeId", new ParseUUIDPipe({ version: "4" }))
    ticketTypeId: string,
  ): Promise<OrganizerTicketTypeDto> {
    return this.organizerTicketTypesService.activateOwnedConcertTicketType(
      request.user.id,
      concertId,
      ticketTypeId,
    );
  }

  @Post(":ticketTypeId/deactivate")
  deactivateTicketType(
    @Req() request: AuthenticatedRequest,
    @Param("concertId", new ParseUUIDPipe({ version: "4" })) concertId: string,
    @Param("ticketTypeId", new ParseUUIDPipe({ version: "4" }))
    ticketTypeId: string,
  ): Promise<OrganizerTicketTypeDto> {
    return this.organizerTicketTypesService.deactivateOwnedConcertTicketType(
      request.user.id,
      concertId,
      ticketTypeId,
    );
  }
}
