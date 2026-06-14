import assert from 'node:assert/strict';
import test from 'node:test';
import { ConcertStatus, TicketTypeStatus } from '@prisma/client';
import { ConcertsService } from './concerts.service';

type PrismaConcertFindManyArgs = {
  where: {
    status: ConcertStatus;
    startsAt: {
      gte: Date;
    };
  };
  orderBy: {
    startsAt: 'asc';
  };
  select: {
    ticketTypes: {
      where: {
        status: TicketTypeStatus;
      };
    };
  };
};

test('public concerts list maps upcoming published concerts to public DTOs and caches the mapped response', async () => {
  const startsAt = new Date('2026-08-20T12:30:00.000Z');
  const endsAt = new Date('2026-08-20T15:30:00.000Z');
  const findManyCalls: PrismaConcertFindManyArgs[] = [];
  let cachedValue: string | null = null;

  const prisma = {
    concert: {
      findMany: async (args: PrismaConcertFindManyArgs) => {
        findManyCalls.push(args);

        return [
          {
            id: 'concert-1',
            title: 'Published Future Concert',
            artistName: 'TicketBox Band',
            description: 'A public concert description',
            venueName: 'TicketBox Arena',
            venueAddress: 'District 1',
            bannerUrl: 'https://example.test/banner.jpg',
            startsAt,
            endsAt,
            ticketTypes: [{ priceVnd: 900000 }, { priceVnd: 500000 }],
          },
          {
            id: 'concert-2',
            title: 'No Active Tickets',
            artistName: null,
            description: null,
            venueName: 'Open Hall',
            venueAddress: null,
            bannerUrl: null,
            startsAt: new Date('2026-09-01T12:00:00.000Z'),
            endsAt: null,
            ticketTypes: [],
          },
        ];
      },
    },
  };
  const redisCache = {
    get: async () => cachedValue,
    set: async (_key: string, value: string, ttlSeconds: number) => {
      assert.equal(_key, 'concerts:list:published');
      assert.equal(ttlSeconds, 60);
      cachedValue = value;
    },
  };
  const service = new ConcertsService(prisma as never, redisCache as never);

  const response = await service.listPublicConcerts();

  assert.equal(findManyCalls.length, 1);
  assert.equal(findManyCalls[0].where.status, ConcertStatus.PUBLISHED);
  assert.ok(findManyCalls[0].where.startsAt.gte instanceof Date);
  assert.deepEqual(findManyCalls[0].orderBy, { startsAt: 'asc' });
  assert.equal(findManyCalls[0].select.ticketTypes.where.status, TicketTypeStatus.ACTIVE);
  assert.deepEqual(response, [
    {
      id: 'concert-1',
      title: 'Published Future Concert',
      artistName: 'TicketBox Band',
      description: 'A public concert description',
      venueName: 'TicketBox Arena',
      venueAddress: 'District 1',
      bannerUrl: 'https://example.test/banner.jpg',
      startsAt: startsAt.toISOString(),
      endsAt: endsAt.toISOString(),
      minPriceVnd: 500000,
    },
    {
      id: 'concert-2',
      title: 'No Active Tickets',
      artistName: null,
      description: null,
      venueName: 'Open Hall',
      venueAddress: null,
      bannerUrl: null,
      startsAt: '2026-09-01T12:00:00.000Z',
      endsAt: null,
      minPriceVnd: null,
    },
  ]);
  assert.ok(cachedValue);
  assert.equal(JSON.parse(cachedValue).length, 2);

  const cachedResponse = await service.listPublicConcerts();

  assert.equal(findManyCalls.length, 1);
  assert.deepEqual(cachedResponse, response);
});
