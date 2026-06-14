import assert from 'node:assert/strict';
import test from 'node:test';
import { NotFoundException } from '@nestjs/common';
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

type PrismaConcertFindFirstArgs = {
  where: {
    id: string;
    status: ConcertStatus;
  };
  select: Record<string, boolean>;
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

test('public concert detail maps published concert metadata and caches the DTO response', async () => {
  const concertId = '11111111-1111-4111-8111-111111111111';
  const startsAt = new Date('2026-08-20T12:30:00.000Z');
  const endsAt = new Date('2026-08-20T15:30:00.000Z');
  const findFirstCalls: PrismaConcertFindFirstArgs[] = [];
  let cachedValue: string | null = null;

  const prisma = {
    concert: {
      findFirst: async (args: PrismaConcertFindFirstArgs) => {
        findFirstCalls.push(args);

        return {
          id: concertId,
          title: 'Published Concert Detail',
          artistName: 'TicketBox Band',
          description: 'Detail description',
          venueName: 'TicketBox Arena',
          venueAddress: 'District 1',
          bannerUrl: 'https://example.test/detail.jpg',
          seatingSvg: '<svg />',
          startsAt,
          endsAt,
        };
      },
    },
  };
  const redisCache = {
    get: async () => cachedValue,
    set: async (key: string, value: string, ttlSeconds: number) => {
      assert.equal(key, `concerts:detail:${concertId}`);
      assert.equal(ttlSeconds, 300);
      cachedValue = value;
    },
    del: async () => undefined,
  };
  const service = new ConcertsService(prisma as never, redisCache as never);

  const response = await service.findPublishedConcertDetail(concertId);

  assert.equal(findFirstCalls.length, 1);
  assert.deepEqual(findFirstCalls[0].where, {
    id: concertId,
    status: ConcertStatus.PUBLISHED,
  });
  assert.equal(findFirstCalls[0].select.id, true);
  assert.equal(findFirstCalls[0].select.seatingSvg, true);
  assert.equal(findFirstCalls[0].select.status, undefined);
  assert.equal(findFirstCalls[0].select.organizerId, undefined);
  assert.equal(findFirstCalls[0].select.ticketTypes, undefined);
  assert.deepEqual(response, {
    id: concertId,
    title: 'Published Concert Detail',
    artistName: 'TicketBox Band',
    description: 'Detail description',
    venueName: 'TicketBox Arena',
    venueAddress: 'District 1',
    bannerUrl: 'https://example.test/detail.jpg',
    seatingSvg: '<svg />',
    startsAt: startsAt.toISOString(),
    endsAt: endsAt.toISOString(),
  });

  const cachedResponse = await service.findPublishedConcertDetail(concertId);

  assert.equal(findFirstCalls.length, 1);
  assert.deepEqual(cachedResponse, response);
});

test('public concert detail deletes corrupted cache and falls back to PostgreSQL', async () => {
  const concertId = '22222222-2222-4222-8222-222222222222';
  const deletedKeys: string[] = [];
  let cachedValue: string | null = '{broken-json';
  let findFirstCalls = 0;

  const prisma = {
    concert: {
      findFirst: async () => {
        findFirstCalls += 1;

        return {
          id: concertId,
          title: 'Recovered Concert',
          artistName: null,
          description: null,
          venueName: 'Recovered Hall',
          venueAddress: null,
          bannerUrl: null,
          seatingSvg: null,
          startsAt: new Date('2026-10-01T12:00:00.000Z'),
          endsAt: null,
        };
      },
    },
  };
  const redisCache = {
    get: async () => cachedValue,
    set: async (_key: string, value: string) => {
      cachedValue = value;
    },
    del: async (key: string) => {
      deletedKeys.push(key);
      cachedValue = null;
    },
  };
  const service = new ConcertsService(prisma as never, redisCache as never);

  const response = await service.findPublishedConcertDetail(concertId);

  assert.equal(findFirstCalls, 1);
  assert.deepEqual(deletedKeys, [`concerts:detail:${concertId}`]);
  assert.equal(response.id, concertId);
  assert.equal(response.seatingSvg, null);
});

test('public concert detail throws not found when no published concert exists', async () => {
  const service = new ConcertsService(
    {
      concert: {
        findFirst: async () => null,
      },
    } as never,
    {
      get: async () => null,
      set: async () => undefined,
      del: async () => undefined,
    } as never,
  );

  await assert.rejects(
    () => service.findPublishedConcertDetail('33333333-3333-4333-8333-333333333333'),
    NotFoundException,
  );
});
