import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { ConcertStatus, Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { ROLE_CODES } from "../rbac/rbac.constants";
import { RedisCacheService } from "../redis-cache/redis-cache.service";
import {
  getPublicConcertDetailCacheKey,
  getPublicTicketTypesCacheKey,
  PUBLIC_CONCERTS_CACHE_KEY,
} from "./concerts.cache";
import { OrganizerConcertCreateDto } from "./dto/organizer-concert-create.dto";
import { OrganizerConcertDetailDto } from "./dto/organizer-concert-detail.dto";
import { OrganizerConcertListItemDto } from "./dto/organizer-concert-list-item.dto";
import { OrganizerConcertUpdateDto } from "./dto/organizer-concert-update.dto";

type OrganizerConcertListQueryResult = {
  id: string;
  status: ConcertStatus;
  title: string;
  artistName: string | null;
  venueName: string;
  startsAt: Date;
  endsAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type OrganizerConcertDetailQueryResult = {
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

type OrganizerConcertLifecycleStatus = "UPCOMING" | "ONGOING" | "ENDED";

@Injectable()
export class OrganizerConcertsService {
  private readonly logger = new Logger(OrganizerConcertsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redisCache: RedisCacheService,
  ) {}

  async listOwnedConcerts(
    organizerId: string,
  ): Promise<OrganizerConcertListItemDto[]> {
    await this.ensureOrganizerRole(organizerId);

    const concerts = await this.prisma.concert.findMany({
      where: {
        organizerId,
      },
      orderBy: {
        createdAt: "desc",
      },
      select: {
        id: true,
        status: true,
        title: true,
        artistName: true,
        venueName: true,
        startsAt: true,
        endsAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return concerts.map((concert) => this.toOrganizerListItem(concert));
  }

  async createConcert(
    organizerId: string,
    dto: OrganizerConcertCreateDto,
  ): Promise<OrganizerConcertDetailDto> {
    await this.ensureOrganizerRole(organizerId);

    const startsAt = this.parseDateString(dto.startsAt, "startsAt");
    const endsAt = this.parseDateString(dto.endsAt, "endsAt");
    this.assertValidDateRange(startsAt, endsAt);

    const concert = await this.prisma.concert.create({
      data: {
        organizerId,
        status: ConcertStatus.PUBLISHED,
        title: dto.title,
        artistName: dto.artistName,
        description: dto.description ?? null,
        venueName: dto.venueName,
        venueAddress: dto.venueAddress,
        bannerUrl: dto.bannerUrl ?? null,
        seatingSvg: dto.seatingSvg ?? null,
        startsAt,
        endsAt,
      },
      select: {
        id: true,
        organizerId: true,
        status: true,
        title: true,
        artistName: true,
        description: true,
        venueName: true,
        venueAddress: true,
        bannerUrl: true,
        seatingSvg: true,
        startsAt: true,
        endsAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    await this.invalidatePublicConcertListCache();

    return this.toOrganizerDetail(concert);
  }

  async getOwnedConcert(
    organizerId: string,
    concertId: string,
  ): Promise<OrganizerConcertDetailDto> {
    await this.ensureOrganizerRole(organizerId);

    const concert = await this.findOwnedConcertOrThrow(organizerId, concertId);

    return this.toOrganizerDetail(concert);
  }

  async updateOwnedConcert(
    organizerId: string,
    concertId: string,
    dto: OrganizerConcertUpdateDto,
  ): Promise<OrganizerConcertDetailDto> {
    await this.ensureOrganizerRole(organizerId);
    this.assertNoNullForRequiredPatchFields(dto);

    const concert = await this.findOwnedConcertOrThrow(organizerId, concertId);
    this.assertConcertEditable(concert);

    const startsAt = dto.startsAt
      ? this.parseDateString(dto.startsAt, "startsAt")
      : concert.startsAt;
    const endsAt = dto.endsAt
      ? this.parseDateString(dto.endsAt, "endsAt")
      : concert.endsAt;

    if (dto.startsAt !== undefined || dto.endsAt !== undefined) {
      this.assertValidDateRange(startsAt, endsAt);
    }

    const concertUpdateData: Prisma.ConcertUpdateInput = {
      title: dto.title,
      artistName: dto.artistName,
      description: dto.description,
      venueName: dto.venueName,
      venueAddress: dto.venueAddress,
      bannerUrl: dto.bannerUrl,
      seatingSvg: dto.seatingSvg,
      startsAt: dto.startsAt ? startsAt : undefined,
      endsAt: dto.endsAt ? endsAt : undefined,
    };

    const updatedConcert = await this.prisma.concert.update({
      where: {
        id: concertId,
      },
      data: concertUpdateData,
      select: {
        id: true,
        organizerId: true,
        status: true,
        title: true,
        artistName: true,
        description: true,
        venueName: true,
        venueAddress: true,
        bannerUrl: true,
        seatingSvg: true,
        startsAt: true,
        endsAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    await this.invalidatePublicConcertCache(concertId);

    return this.toOrganizerDetail(updatedConcert);
  }

  async cancelOwnedConcert(
    organizerId: string,
    concertId: string,
  ): Promise<OrganizerConcertDetailDto> {
    await this.ensureOrganizerRole(organizerId);

    const concert = await this.findOwnedConcertOrThrow(organizerId, concertId);
    this.assertConcertCancelable(concert);

    const cancelledConcert = await this.prisma.concert.update({
      where: {
        id: concertId,
      },
      data: {
        status: ConcertStatus.CANCELLED,
      },
      select: {
        id: true,
        organizerId: true,
        status: true,
        title: true,
        artistName: true,
        description: true,
        venueName: true,
        venueAddress: true,
        bannerUrl: true,
        seatingSvg: true,
        startsAt: true,
        endsAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    await this.invalidatePublicConcertCache(concertId);

    return this.toOrganizerDetail(cancelledConcert);
  }

  async ensureOrganizerRole(userId: string): Promise<void> {
    const organizerRole = await this.prisma.role.findUnique({
      where: {
        code: ROLE_CODES.organizer,
      },
      select: {
        id: true,
      },
    });

    if (!organizerRole) {
      throw new ForbiddenException("Organizer role is not configured");
    }

    const userRole = await this.prisma.userRole.findFirst({
      where: {
        userId,
        roleId: organizerRole.id,
      },
      select: {
        userId: true,
      },
    });

    if (!userRole) {
      throw new ForbiddenException("Organizer access is required");
    }
  }

  async findOwnedConcertOrThrow(
    organizerId: string,
    concertId: string,
  ): Promise<OrganizerConcertDetailQueryResult> {
    const concert = await this.prisma.concert.findFirst({
      where: {
        id: concertId,
        organizerId,
      },
      select: {
        id: true,
        organizerId: true,
        status: true,
        title: true,
        artistName: true,
        description: true,
        venueName: true,
        venueAddress: true,
        bannerUrl: true,
        seatingSvg: true,
        startsAt: true,
        endsAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!concert) {
      throw new NotFoundException("Concert not found");
    }

    return concert;
  }

  private assertNoNullForRequiredPatchFields(
    dto: OrganizerConcertUpdateDto,
  ): void {
    const fields = [
      "title",
      "artistName",
      "venueName",
      "venueAddress",
      "startsAt",
      "endsAt",
    ] as const;

    for (const field of fields) {
      if (dto[field] === null) {
        throw new BadRequestException(`${field} must not be null`);
      }
    }
  }

  private parseDateString(value: string, fieldName: string): Date {
    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException(`${fieldName} must be a valid date`);
    }

    return date;
  }

  private assertValidDateRange(startsAt: Date, endsAt: Date | null): void {
    if (!endsAt || startsAt >= endsAt) {
      throw new BadRequestException("startsAt must be earlier than endsAt");
    }
  }

  private assertConcertEditable(
    concert: OrganizerConcertDetailQueryResult,
  ): void {
    if (concert.status === ConcertStatus.CANCELLED) {
      throw new ConflictException("Concert đã hủy nên không thể chỉnh sửa.");
    }

    if (this.getLifecycleStatus(concert) !== "UPCOMING") {
      throw new ConflictException(
        "Concert đang diễn ra hoặc đã kết thúc nên không thể chỉnh sửa.",
      );
    }
  }

  private assertConcertCancelable(
    concert: OrganizerConcertDetailQueryResult,
  ): void {
    if (concert.status === ConcertStatus.CANCELLED) {
      throw new ConflictException("Concert đã hủy nên không thể hủy.");
    }

    if (this.getLifecycleStatus(concert) !== "UPCOMING") {
      throw new ConflictException(
        "Concert đang diễn ra hoặc đã kết thúc nên không thể hủy.",
      );
    }
  }

  private async invalidatePublicConcertListCache(): Promise<void> {
    await this.invalidateCacheKeys([PUBLIC_CONCERTS_CACHE_KEY]);
  }

  private async invalidatePublicConcertCache(concertId: string): Promise<void> {
    await this.invalidateCacheKeys([
      PUBLIC_CONCERTS_CACHE_KEY,
      getPublicConcertDetailCacheKey(concertId),
      getPublicTicketTypesCacheKey(concertId),
    ]);
  }

  private async invalidateCacheKeys(cacheKeys: string[]): Promise<void> {
    const results = await Promise.allSettled(
      cacheKeys.map((cacheKey) => this.redisCache.del(cacheKey)),
    );

    for (const [index, result] of results.entries()) {
      if (result.status === "rejected") {
        const errorMessage =
          result.reason instanceof Error
            ? result.reason.message
            : "Unknown Redis error";
        this.logger.warn(
          `Public cache invalidation failed for key "${cacheKeys[index]}": ${errorMessage}`,
        );
      }
    }
  }

  private getLifecycleStatus(
    concert: Pick<OrganizerConcertDetailQueryResult, "startsAt" | "endsAt">,
    now = new Date(),
  ): OrganizerConcertLifecycleStatus {
    const endsAt = concert.endsAt ?? concert.startsAt;

    if (now < concert.startsAt) {
      return "UPCOMING";
    }

    if (now <= endsAt) {
      return "ONGOING";
    }

    return "ENDED";
  }

  private toOrganizerListItem(
    concert: OrganizerConcertListQueryResult,
  ): OrganizerConcertListItemDto {
    return {
      id: concert.id,
      status: concert.status,
      lifecycleStatus: this.getLifecycleStatus(concert),
      title: concert.title,
      artistName: concert.artistName,
      venueName: concert.venueName,
      startsAt: concert.startsAt.toISOString(),
      endsAt: concert.endsAt?.toISOString() ?? null,
      createdAt: concert.createdAt.toISOString(),
      updatedAt: concert.updatedAt.toISOString(),
    };
  }

  private toOrganizerDetail(
    concert: OrganizerConcertDetailQueryResult,
  ): OrganizerConcertDetailDto {
    return {
      id: concert.id,
      status: concert.status,
      lifecycleStatus: this.getLifecycleStatus(concert),
      title: concert.title,
      artistName: concert.artistName,
      description: concert.description,
      venueName: concert.venueName,
      venueAddress: concert.venueAddress,
      bannerUrl: concert.bannerUrl,
      seatingSvg: concert.seatingSvg,
      startsAt: concert.startsAt.toISOString(),
      endsAt: concert.endsAt?.toISOString() ?? null,
      createdAt: concert.createdAt.toISOString(),
      updatedAt: concert.updatedAt.toISOString(),
    };
  }
}
