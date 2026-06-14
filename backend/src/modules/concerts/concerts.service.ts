import { Injectable } from '@nestjs/common';
import { ConcertStatus, TicketTypeStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisCacheService } from '../redis-cache/redis-cache.service';
import { PublicConcertListItemDto } from './dto/public-concert-list-item.dto';

const PUBLIC_CONCERTS_CACHE_KEY = 'concerts:list:published';
const PUBLIC_CONCERTS_CACHE_TTL_SECONDS = 60;

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
}
