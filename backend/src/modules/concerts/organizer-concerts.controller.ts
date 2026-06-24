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
import { OrganizerConcertCreateDto } from "./dto/organizer-concert-create.dto";
import { OrganizerConcertDetailDto } from "./dto/organizer-concert-detail.dto";
import { OrganizerConcertListItemDto } from "./dto/organizer-concert-list-item.dto";
import { OrganizerConcertUpdateDto } from "./dto/organizer-concert-update.dto";
import { OrganizerConcertsService } from "./organizer-concerts.service";

type AuthenticatedRequest = {
  user: AuthenticatedUser;
};

@Controller("organizer/concerts")
@UseGuards(JwtAuthGuard)
export class OrganizerConcertsController {
  constructor(
    private readonly organizerConcertsService: OrganizerConcertsService,
  ) {}

  @Get()
  listOwnedConcerts(
    @Req() request: AuthenticatedRequest,
  ): Promise<OrganizerConcertListItemDto[]> {
    return this.organizerConcertsService.listOwnedConcerts(request.user.id);
  }

  @Post()
  createConcert(
    @Req() request: AuthenticatedRequest,
    @Body() dto: OrganizerConcertCreateDto,
  ): Promise<OrganizerConcertDetailDto> {
    return this.organizerConcertsService.createConcert(request.user.id, dto);
  }

  @Get(":id")
  getOwnedConcert(
    @Req() request: AuthenticatedRequest,
    @Param("id", new ParseUUIDPipe({ version: "4" })) concertId: string,
  ): Promise<OrganizerConcertDetailDto> {
    return this.organizerConcertsService.getOwnedConcert(
      request.user.id,
      concertId,
    );
  }

  @Patch(":id")
  updateOwnedConcert(
    @Req() request: AuthenticatedRequest,
    @Param("id", new ParseUUIDPipe({ version: "4" })) concertId: string,
    @Body() dto: OrganizerConcertUpdateDto,
  ): Promise<OrganizerConcertDetailDto> {
    return this.organizerConcertsService.updateOwnedConcert(
      request.user.id,
      concertId,
      dto,
    );
  }

  @Post(":id/publish")
  publishOwnedConcert(
    @Req() request: AuthenticatedRequest,
    @Param("id", new ParseUUIDPipe({ version: "4" })) concertId: string,
  ): Promise<OrganizerConcertDetailDto> {
    return this.organizerConcertsService.publishOwnedConcert(
      request.user.id,
      concertId,
    );
  }
}
