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
import { RateLimit } from "../rate-limit/rate-limit.decorator";
import { RateLimitGuard } from "../rate-limit/rate-limit.guard";
import { Permissions } from "../rbac/permissions.decorator";
import { PermissionsGuard } from "../rbac/permissions.guard";
import { PERMISSION_CODES } from "../rbac/rbac.constants";
import { AuthenticatedUser } from "../auth/types";
import { OrganizerTicketTypeCreateDto } from "./dto/organizer-ticket-type-create.dto";
import { OrganizerTicketTypeDto } from "./dto/organizer-ticket-type.dto";
import { OrganizerTicketTypeUpdateDto } from "./dto/organizer-ticket-type-update.dto";
import { OrganizerTicketTypesService } from "./organizer-ticket-types.service";

type AuthenticatedRequest = {
  user: AuthenticatedUser;
};

@Controller("organizer/concerts/:concertId/ticket-types")
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Permissions(PERMISSION_CODES.concertTicketTypeManage)
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
  @UseGuards(RateLimitGuard)
  @RateLimit({
    keyPrefix: "organizer-mutation",
    limit: 20,
    ttlSeconds: 5 * 60,
    identity: "user_or_ip",
  })
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
  @UseGuards(RateLimitGuard)
  @RateLimit({
    keyPrefix: "organizer-mutation",
    limit: 20,
    ttlSeconds: 5 * 60,
    identity: "user_or_ip",
  })
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
  @UseGuards(RateLimitGuard)
  @RateLimit({
    keyPrefix: "organizer-mutation",
    limit: 20,
    ttlSeconds: 5 * 60,
    identity: "user_or_ip",
  })
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
  @UseGuards(RateLimitGuard)
  @RateLimit({
    keyPrefix: "organizer-mutation",
    limit: 20,
    ttlSeconds: 5 * 60,
    identity: "user_or_ip",
  })
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
