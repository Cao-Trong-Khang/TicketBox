import { Injectable, NotFoundException } from '@nestjs/common';
import { ConcertStatus, TicketTypeStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisCacheService } from '../redis-cache/redis-cache.service';
import { PublicConcertDetailDto } from './dto/public-concert-detail.dto';
import { PublicConcertListItemDto } from './dto/public-concert-list-item.dto';
import { PublicTicketTypeDto } from './dto/public-ticket-type.dto';

const PUBLIC_CONCERTS_CACHE_KEY = 'concerts:list:published';
const PUBLIC_CONCERTS_CACHE_TTL_SECONDS = 60;
const PUBLIC_CONCERT_DETAIL_CACHE_TTL_SECONDS = 300;
const PUBLIC_TICKET_TYPES_CACHE_TTL_SECONDS = 5;

type PublicConcertQueryResult = {
  id: string;
  title: string;
  artistName: string | null;
  description: string | null;
  venueName: string;
  venueAddress: string | null;
  bannerUrl: string | null;
  startsAt: Date;
  endsAt: Date | null;
  ticketTypes: {
    priceVnd: number;
  }[];
};

type PublicConcertDetailQueryResult = {
  id: string;
  title: string;
  artistName: string | null;
  description: string | null;
  venueName: string;
  venueAddress: string | null;
  bannerUrl: string | null;
  seatingSvg: string | null;
  startsAt: Date;
  endsAt: Date | null;
};

type PublicTicketTypesQueryResult = {
  ticketTypes: PublicTicketTypeQueryResult[];
};

type PublicTicketTypeQueryResult = {
  id: string;
  code: string;
  name: string;
  priceVnd: number;
  totalQuantity: number;
  reservedQuantity: number;
  soldQuantity: number;
  perUserLimit: number;
  saleStartAt: Date;
  saleEndAt: Date | null;
};

@Injectable()
export class ConcertsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redisCache: RedisCacheService,
  ) {}

  async listPublicConcerts(): Promise<PublicConcertListItemDto[]> {
    const cached = await this.redisCache.get(PUBLIC_CONCERTS_CACHE_KEY);

    if (cached) {
      return JSON.parse(cached) as PublicConcertListItemDto[];
    }

    const concerts = await this.prisma.concert.findMany({
      where: {
        status: ConcertStatus.PUBLISHED,
        startsAt: {
          gte: new Date(),
        },
      },
      orderBy: {
        startsAt: 'asc',
      },
      select: {
        id: true,
        title: true,
        artistName: true,
        description: true,
        venueName: true,
        venueAddress: true,
        bannerUrl: true,
        startsAt: true,
        endsAt: true,
        ticketTypes: {
          where: {
            status: TicketTypeStatus.ACTIVE,
          },
          select: {
            priceVnd: true,
          },
        },
      },
    });

    const response = concerts.map((concert) => this.toPublicListItem(concert));

    await this.redisCache.set(
      PUBLIC_CONCERTS_CACHE_KEY,
      JSON.stringify(response),
      PUBLIC_CONCERTS_CACHE_TTL_SECONDS,
    );

    return response;
  }

  async findPublishedConcertDetail(concertId: string): Promise<PublicConcertDetailDto> {
    const cacheKey = this.getPublicConcertDetailCacheKey(concertId);
    const cached = await this.redisCache.get(cacheKey);

    if (cached) {
      const cachedDetail = await this.tryParseCachedDetail(cacheKey, cached);

      if (cachedDetail) {
        return cachedDetail;
      }
    }

    const concert = await this.prisma.concert.findFirst({
      where: {
        id: concertId,
        status: ConcertStatus.PUBLISHED,
      },
      select: {
        id: true,
        title: true,
        artistName: true,
        description: true,
        venueName: true,
        venueAddress: true,
        bannerUrl: true,
        seatingSvg: true,
        startsAt: true,
        endsAt: true,
      },
    });

    if (!concert) {
      throw new NotFoundException('Concert not found');
    }

    const response = this.toPublicDetail(concert);

    await this.redisCache.set(
      cacheKey,
      JSON.stringify(response),
      PUBLIC_CONCERT_DETAIL_CACHE_TTL_SECONDS,
    );

    return response;
  }

  async findPublishedConcertTicketTypes(concertId: string): Promise<PublicTicketTypeDto[]> {
    const cacheKey = this.getPublicTicketTypesCacheKey(concertId);
    const cached = await this.redisCache.get(cacheKey);

    if (cached) {
      const cachedTicketTypes = await this.tryParseCachedTicketTypes(cacheKey, cached);

      if (cachedTicketTypes) {
        return cachedTicketTypes;
      }
    }

    const concert = await this.prisma.concert.findFirst({
      where: {
        id: concertId,
        status: ConcertStatus.PUBLISHED,
      },
      select: {
        ticketTypes: {
          where: {
            status: TicketTypeStatus.ACTIVE,
          },
          orderBy: [{ priceVnd: 'asc' }, { code: 'asc' }],
          select: {
            id: true,
            code: true,
            name: true,
            priceVnd: true,
            totalQuantity: true,
            reservedQuantity: true,
            soldQuantity: true,
            perUserLimit: true,
            saleStartAt: true,
            saleEndAt: true,
          },
        },
      },
    });

    if (!concert) {
      throw new NotFoundException('Concert not found');
    }

    const response = this.toPublicTicketTypes(concert);

    await this.redisCache.set(
      cacheKey,
      JSON.stringify(response),
      PUBLIC_TICKET_TYPES_CACHE_TTL_SECONDS,
    );

    return response;
  }

  private toPublicListItem(concert: PublicConcertQueryResult): PublicConcertListItemDto {
    const prices = concert.ticketTypes.map((ticketType) => ticketType.priceVnd);

    return {
      id: concert.id,
      title: concert.title,
      artistName: concert.artistName,
      description: concert.description,
      venueName: concert.venueName,
      venueAddress: concert.venueAddress,
      bannerUrl: concert.bannerUrl,
      startsAt: concert.startsAt.toISOString(),
      endsAt: concert.endsAt?.toISOString() ?? null,
      minPriceVnd: prices.length > 0 ? Math.min(...prices) : null,
    };
  }

  private toPublicDetail(concert: PublicConcertDetailQueryResult): PublicConcertDetailDto {
    return {
      id: concert.id,
      title: concert.title,
      artistName: concert.artistName,
      description: concert.description,
      venueName: concert.venueName,
      venueAddress: concert.venueAddress,
      bannerUrl: concert.bannerUrl,
      seatingSvg: concert.seatingSvg,
      startsAt: concert.startsAt.toISOString(),
      endsAt: concert.endsAt?.toISOString() ?? null,
    };
  }

  private getPublicConcertDetailCacheKey(concertId: string): string {
    return `concerts:detail:${concertId}`;
  }

  private toPublicTicketTypes(concert: PublicTicketTypesQueryResult): PublicTicketTypeDto[] {
    return concert.ticketTypes.map((ticketType) => ({
      id: ticketType.id,
      code: ticketType.code,
      name: ticketType.name,
      priceVnd: ticketType.priceVnd,
      totalQuantity: ticketType.totalQuantity,
      availableQuantity: Math.max(
        0,
        ticketType.totalQuantity - ticketType.reservedQuantity - ticketType.soldQuantity,
      ),
      perUserLimit: ticketType.perUserLimit,
      saleStartAt: ticketType.saleStartAt.toISOString(),
      saleEndAt: ticketType.saleEndAt?.toISOString() ?? null,
    }));
  }

  private getPublicTicketTypesCacheKey(concertId: string): string {
    return `concerts:${concertId}:ticket-types`;
  }

  private async tryParseCachedDetail(
    cacheKey: string,
    cached: string,
  ): Promise<PublicConcertDetailDto | null> {
    try {
      return JSON.parse(cached) as PublicConcertDetailDto;
    } catch {
      await this.redisCache.del(cacheKey);
      return null;
    }
  }

  private async tryParseCachedTicketTypes(
    cacheKey: string,
    cached: string,
  ): Promise<PublicTicketTypeDto[] | null> {
    try {
      return JSON.parse(cached) as PublicTicketTypeDto[];
    } catch {
      await this.redisCache.del(cacheKey);
      return null;
    }
  }
}
