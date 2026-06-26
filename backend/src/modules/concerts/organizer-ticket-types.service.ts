import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { ConcertStatus, Prisma, TicketTypeStatus } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { RedisCacheService } from "../redis-cache/redis-cache.service";
import { getPublicTicketTypesCacheKey } from "./concerts.cache";
import { OrganizerConcertsService } from "./organizer-concerts.service";
import { OrganizerTicketTypeCreateDto } from "./dto/organizer-ticket-type-create.dto";
import { OrganizerTicketTypeDto } from "./dto/organizer-ticket-type.dto";
import { OrganizerTicketTypeUpdateDto } from "./dto/organizer-ticket-type-update.dto";

type OrganizerOwnedConcertRecord = {
  id: string;
  organizerId: string;
  status: ConcertStatus;
  title: string;
  artistName: string | null;
  description: string | null;
  venueName: string;
  venueAddress: string | null;
  bannerUrl: string | null;
  seatingSvg: string | null;
  startsAt: Date;
  endsAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

type OrganizerTicketTypeRecord = {
  id: string;
  concertId: string;
  code: string;
  name: string;
  priceVnd: number;
  totalQuantity: number;
  reservedQuantity: number;
  soldQuantity: number;
  perUserLimit: number;
  saleStartAt: Date;
  saleEndAt: Date | null;
  status: TicketTypeStatus;
  createdAt: Date;
  updatedAt: Date;
};

@Injectable()
export class OrganizerTicketTypesService {
  private readonly logger = new Logger(OrganizerTicketTypesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redisCache: RedisCacheService,
    private readonly organizerConcertsService: OrganizerConcertsService,
  ) {}

  async listOwnedConcertTicketTypes(
    organizerId: string,
    concertId: string,
  ): Promise<OrganizerTicketTypeDto[]> {
    await this.organizerConcertsService.ensureOrganizerRole(organizerId);
    await this.getOwnedConcertOrThrow(organizerId, concertId);

    const ticketTypes = await this.prisma.ticketType.findMany({
      where: {
        concertId,
      },
      orderBy: [{ priceVnd: "asc" }, { code: "asc" }],
      select: this.ticketTypeSelect,
    });

    return ticketTypes.map((ticketType) => this.toOrganizerTicketType(ticketType));
  }

  async createOwnedConcertTicketType(
    organizerId: string,
    concertId: string,
    dto: OrganizerTicketTypeCreateDto,
  ): Promise<OrganizerTicketTypeDto> {
    await this.organizerConcertsService.ensureOrganizerRole(organizerId);
    await this.getOwnedConcertOrThrow(organizerId, concertId);

    this.assertCreateRules(dto);
    await this.ensureUniqueCode(concertId, dto.code);

    const saleStartAt =
      this.parseOptionalDate(dto.saleStartAt, "saleStartAt") ?? new Date();
    const saleEndAt = this.parseOptionalDate(dto.saleEndAt, "saleEndAt");
    this.assertValidSaleWindow(saleStartAt, saleEndAt);

    try {
      const ticketType = await this.prisma.ticketType.create({
        data: {
          concertId,
          code: dto.code,
          name: dto.name,
          priceVnd: dto.priceVnd,
          totalQuantity: dto.totalQuantity,
          perUserLimit: dto.perUserLimit,
          saleStartAt,
          saleEndAt,
          status: TicketTypeStatus.INACTIVE,
        },
        select: this.ticketTypeSelect,
      });

      await this.invalidatePublicTicketTypesCache(concertId);

      return this.toOrganizerTicketType(ticketType);
    } catch (error) {
      this.rethrowDuplicateCodeIfNeeded(error);
      throw error;
    }
  }

  async updateOwnedConcertTicketType(
    organizerId: string,
    concertId: string,
    ticketTypeId: string,
    dto: OrganizerTicketTypeUpdateDto,
  ): Promise<OrganizerTicketTypeDto> {
    await this.organizerConcertsService.ensureOrganizerRole(organizerId);
    await this.getOwnedConcertOrThrow(organizerId, concertId);

    const ticketType = await this.getOwnedConcertTicketTypeOrThrow(concertId, ticketTypeId);

    const mergedPriceVnd = dto.priceVnd ?? ticketType.priceVnd;
    const mergedTotalQuantity = dto.totalQuantity ?? ticketType.totalQuantity;
    const mergedPerUserLimit = dto.perUserLimit ?? ticketType.perUserLimit;
    const mergedSaleStartAt =
      dto.saleStartAt === undefined
        ? ticketType.saleStartAt
        : this.parseRequiredDate(dto.saleStartAt, "saleStartAt");
    const mergedSaleEndAt =
      dto.saleEndAt === undefined
        ? ticketType.saleEndAt
        : this.parseOptionalDate(dto.saleEndAt, "saleEndAt");

    this.assertUpdateRules({
      priceVnd: mergedPriceVnd,
      totalQuantity: mergedTotalQuantity,
      perUserLimit: mergedPerUserLimit,
      saleStartAt: mergedSaleStartAt,
      saleEndAt: mergedSaleEndAt,
      reservedQuantity: ticketType.reservedQuantity,
      soldQuantity: ticketType.soldQuantity,
    });

    if (dto.code !== undefined && dto.code !== ticketType.code) {
      await this.ensureUniqueCode(concertId, dto.code, ticketTypeId);
    }

    try {
      const updatedTicketType = await this.prisma.ticketType.update({
        where: {
          id: ticketTypeId,
        },
        data: {
          code: dto.code,
          name: dto.name,
          priceVnd: dto.priceVnd,
          totalQuantity: dto.totalQuantity,
          perUserLimit: dto.perUserLimit,
          saleStartAt: dto.saleStartAt === undefined ? undefined : mergedSaleStartAt,
          saleEndAt: dto.saleEndAt === undefined ? undefined : mergedSaleEndAt,
        },
        select: this.ticketTypeSelect,
      });

      await this.invalidatePublicTicketTypesCache(concertId);

      return this.toOrganizerTicketType(updatedTicketType);
    } catch (error) {
      this.rethrowDuplicateCodeIfNeeded(error);
      throw error;
    }
  }

  async activateOwnedConcertTicketType(
    organizerId: string,
    concertId: string,
    ticketTypeId: string,
  ): Promise<OrganizerTicketTypeDto> {
    return this.updateTicketTypeStatus(
      organizerId,
      concertId,
      ticketTypeId,
      TicketTypeStatus.ACTIVE,
      "Ticket type is already active",
    );
  }

  async deactivateOwnedConcertTicketType(
    organizerId: string,
    concertId: string,
    ticketTypeId: string,
  ): Promise<OrganizerTicketTypeDto> {
    return this.updateTicketTypeStatus(
      organizerId,
      concertId,
      ticketTypeId,
      TicketTypeStatus.INACTIVE,
      "Ticket type is already inactive",
    );
  }

  private get ticketTypeSelect() {
    return {
      id: true,
      concertId: true,
      code: true,
      name: true,
      priceVnd: true,
      totalQuantity: true,
      reservedQuantity: true,
      soldQuantity: true,
      perUserLimit: true,
      saleStartAt: true,
      saleEndAt: true,
      status: true,
      createdAt: true,
      updatedAt: true,
    } as const;
  }

  private async getOwnedConcertOrThrow(
    organizerId: string,
    concertId: string,
  ): Promise<OrganizerOwnedConcertRecord> {
    return this.organizerConcertsService.findOwnedConcertOrThrow(organizerId, concertId);
  }

  private async getOwnedConcertTicketTypeOrThrow(
    concertId: string,
    ticketTypeId: string,
  ): Promise<OrganizerTicketTypeRecord> {
    const ticketType = await this.prisma.ticketType.findFirst({
      where: {
        id: ticketTypeId,
        concertId,
      },
      select: this.ticketTypeSelect,
    });

    if (!ticketType) {
      throw new NotFoundException("Ticket type not found");
    }

    return ticketType;
  }

  private assertCreateRules(dto: OrganizerTicketTypeCreateDto): void {
    if (dto.perUserLimit > dto.totalQuantity) {
      throw new BadRequestException("perUserLimit must not exceed totalQuantity");
    }
  }

  private assertUpdateRules(input: {
    priceVnd: number;
    totalQuantity: number;
    perUserLimit: number;
    saleStartAt: Date;
    saleEndAt: Date | null;
    reservedQuantity: number;
    soldQuantity: number;
  }): void {
    if (input.priceVnd < 0) {
      throw new BadRequestException("priceVnd must be greater than or equal to 0");
    }

    if (input.totalQuantity <= 0) {
      throw new BadRequestException("totalQuantity must be greater than 0");
    }

    if (input.perUserLimit <= 0) {
      throw new BadRequestException("perUserLimit must be greater than 0");
    }

    if (input.perUserLimit > input.totalQuantity) {
      throw new BadRequestException("perUserLimit must not exceed totalQuantity");
    }

    this.assertValidSaleWindow(input.saleStartAt, input.saleEndAt);

    const allocatedQuantity = input.reservedQuantity + input.soldQuantity;
    if (input.totalQuantity < allocatedQuantity) {
      throw new ConflictException(
        "totalQuantity must be greater than or equal to reservedQuantity + soldQuantity",
      );
    }
  }

  private async ensureUniqueCode(
    concertId: string,
    code: string,
    excludeTicketTypeId?: string,
  ): Promise<void> {
    const existingTicketType = await this.prisma.ticketType.findFirst({
      where: {
        concertId,
        code,
        id: excludeTicketTypeId ? { not: excludeTicketTypeId } : undefined,
      },
      select: {
        id: true,
      },
    });

    if (existingTicketType) {
      throw new ConflictException("Ticket type code already exists in this concert");
    }
  }

  private parseOptionalDate(value: string | null | undefined, fieldName: string): Date | null {
    if (value === undefined || value === null) {
      return null;
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException(`${fieldName} must be a valid date`);
    }

    return date;
  }

  private parseRequiredDate(value: string, fieldName: string): Date {
    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException(`${fieldName} must be a valid date`);
    }

    return date;
  }

  private assertValidSaleWindow(
    saleStartAt: Date | null,
    saleEndAt: Date | null,
  ): void {
    if (saleStartAt && saleEndAt && saleStartAt >= saleEndAt) {
      throw new BadRequestException("saleStartAt must be earlier than saleEndAt");
    }
  }

  private async updateTicketTypeStatus(
    organizerId: string,
    concertId: string,
    ticketTypeId: string,
    targetStatus: TicketTypeStatus,
    duplicateStatusMessage: string,
  ): Promise<OrganizerTicketTypeDto> {
    await this.organizerConcertsService.ensureOrganizerRole(organizerId);
    await this.getOwnedConcertOrThrow(organizerId, concertId);

    const ticketType = await this.getOwnedConcertTicketTypeOrThrow(concertId, ticketTypeId);

    if (ticketType.status === targetStatus) {
      throw new ConflictException(duplicateStatusMessage);
    }

    const updatedTicketType = await this.prisma.ticketType.update({
      where: {
        id: ticketTypeId,
      },
      data: {
        status: targetStatus,
      },
      select: this.ticketTypeSelect,
    });

    await this.invalidatePublicTicketTypesCache(concertId);

    return this.toOrganizerTicketType(updatedTicketType);
  }

  private async invalidatePublicTicketTypesCache(concertId: string): Promise<void> {
    const cacheKey = getPublicTicketTypesCacheKey(concertId);

    try {
      await this.redisCache.del(cacheKey);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown Redis error";
      this.logger.warn(
        `Public ticket-type cache invalidation failed for key "${cacheKey}": ${errorMessage}`,
      );
    }
  }

  private rethrowDuplicateCodeIfNeeded(error: unknown): void {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      throw new ConflictException("Ticket type code already exists in this concert");
    }
  }

  private toOrganizerTicketType(
    ticketType: OrganizerTicketTypeRecord,
  ): OrganizerTicketTypeDto {
    return {
      id: ticketType.id,
      code: ticketType.code,
      name: ticketType.name,
      priceVnd: ticketType.priceVnd,
      totalQuantity: ticketType.totalQuantity,
      reservedQuantity: ticketType.reservedQuantity,
      soldQuantity: ticketType.soldQuantity,
      availableQuantity: Math.max(
        0,
        ticketType.totalQuantity -
          ticketType.reservedQuantity -
          ticketType.soldQuantity,
      ),
      perUserLimit: ticketType.perUserLimit,
      saleStartAt: ticketType.saleStartAt?.toISOString() ?? null,
      saleEndAt: ticketType.saleEndAt?.toISOString() ?? null,
      status: ticketType.status,
      createdAt: ticketType.createdAt.toISOString(),
      updatedAt: ticketType.updatedAt.toISOString(),
    };
  }
}
