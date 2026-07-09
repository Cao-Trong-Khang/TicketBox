import assert from 'node:assert/strict';
import test from 'node:test';
import { NotFoundException } from '@nestjs/common';
import { ConcertStatus, TicketTypeStatus } from '@prisma/client';
import { ConcertsService } from './concerts.service';

type PrismaConcertFindManyArgs = {
  where: {
    status: ConcertStatus;
    performanceStartAt: {
      gte: Date;
    };
  };
  orderBy: {
    performanceStartAt: 'asc';
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

type PrismaConcertFindFirstTicketTypesArgs = {
  where: {
    id: string;
    status: ConcertStatus;
  };
  select: {
    ticketTypes: {
      where: {
        status: TicketTypeStatus;
      };
      orderBy: [{ priceVnd: 'asc' }, { code: 'asc' }];
      select: Record<string, boolean>;
    };
  };
};

test('public concerts list maps upcoming published concerts to public DTOs and caches the mapped response', async () => {
  const startsAt = new Date('2026-08-20T12:30:00.000Z');
  const endsAt = new Date('2026-08-20T15:30:00.000Z');
  const performanceStartAt = new Date('2026-08-20T20:00:00.000Z');
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
            performanceStartAt,
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
            performanceStartAt: new Date('2026-09-01T20:00:00.000Z'),
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
  assert.ok(findManyCalls[0].where.performanceStartAt.gte instanceof Date);
  assert.deepEqual(findManyCalls[0].orderBy, { performanceStartAt: 'asc' });
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
      performanceStartAt: performanceStartAt.toISOString(),
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
      performanceStartAt: '2026-09-01T20:00:00.000Z',
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
  const performanceStartAt = new Date('2026-08-20T20:00:00.000Z');
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
          performanceStartAt,
          aiArtistBios: [{ generatedBio: 'Latest completed biography' }]
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
    performanceStartAt: performanceStartAt.toISOString(),
    artist_bio: 'Latest completed biography',
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
          performanceStartAt: null,
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

test('public concert detail hides cancelled concerts because only published concerts are queryable', async () => {
  const findFirstCalls: PrismaConcertFindFirstArgs[] = [];
  const service = new ConcertsService(
    {
      concert: {
        findFirst: async (args: PrismaConcertFindFirstArgs) => {
          findFirstCalls.push(args);
          return null;
        },
      },
    } as never,
    {
      get: async () => null,
      set: async () => undefined,
      del: async () => undefined,
    } as never,
  );

  await assert.rejects(
    () => service.findPublishedConcertDetail('33333333-3333-4333-8333-333333333334'),
    NotFoundException,
  );
  assert.equal(findFirstCalls.length, 1);
  assert.equal(findFirstCalls[0].where.status, ConcertStatus.PUBLISHED);
});

test('public concert ticket types maps active ticket types with computed availability and short cache TTL', async () => {
  const concertId = '44444444-4444-4444-8444-444444444444';
  const saleStartAt = new Date('2026-06-01T13:00:00.000Z');
  const saleEndAt = new Date('2026-08-20T12:30:00.000Z');
  const findFirstCalls: PrismaConcertFindFirstTicketTypesArgs[] = [];
  let cachedValue: string | null = null;

  const prisma = {
    concert: {
      findFirst: async (args: PrismaConcertFindFirstTicketTypesArgs) => {
        findFirstCalls.push(args);

        return {
          ticketTypes: [
            {
              id: 'ticket-type-1',
              code: 'GA',
              name: 'General Admission',
              priceVnd: 800000,
              totalQuantity: 100,
              reservedQuantity: 20,
              soldQuantity: 30,
              perUserLimit: 4,
              saleStartAt,
              saleEndAt,
            },
            {
              id: 'ticket-type-2',
              code: 'VIP',
              name: 'VIP',
              priceVnd: 2000000,
              totalQuantity: 10,
              reservedQuantity: 8,
              soldQuantity: 8,
              perUserLimit: 2,
              saleStartAt,
              saleEndAt: null,
            },
          ],
        };
      },
    },
  };
  const redisCache = {
    get: async () => cachedValue,
    set: async (key: string, value: string, ttlSeconds: number) => {
      assert.equal(key, `concerts:${concertId}:ticket-types`);
      assert.equal(ttlSeconds, 5);
      cachedValue = value;
    },
    del: async () => undefined,
  };
  const service = new ConcertsService(prisma as never, redisCache as never);

  const response = await service.findPublishedConcertTicketTypes(concertId);

  assert.equal(findFirstCalls.length, 1);
  assert.deepEqual(findFirstCalls[0].where, {
    id: concertId,
    status: ConcertStatus.PUBLISHED,
  });
  assert.equal(findFirstCalls[0].select.ticketTypes.where.status, TicketTypeStatus.ACTIVE);
  assert.deepEqual(findFirstCalls[0].select.ticketTypes.orderBy, [
    { priceVnd: 'asc' },
    { code: 'asc' },
  ]);
  assert.equal(findFirstCalls[0].select.ticketTypes.select.reservedQuantity, true);
  assert.equal(findFirstCalls[0].select.ticketTypes.select.soldQuantity, true);
  assert.equal(findFirstCalls[0].select.ticketTypes.select.concertId, undefined);
  assert.equal(findFirstCalls[0].select.ticketTypes.select.createdAt, undefined);
  assert.deepEqual(response, [
    {
      id: 'ticket-type-1',
      code: 'GA',
      name: 'General Admission',
      priceVnd: 800000,
      totalQuantity: 100,
      availableQuantity: 50,
      perUserLimit: 4,
      saleStartAt: saleStartAt.toISOString(),
      saleEndAt: saleEndAt.toISOString(),
    },
    {
      id: 'ticket-type-2',
      code: 'VIP',
      name: 'VIP',
      priceVnd: 2000000,
      totalQuantity: 10,
      availableQuantity: 0,
      perUserLimit: 2,
      saleStartAt: saleStartAt.toISOString(),
      saleEndAt: null,
    },
  ]);

  const cachedResponse = await service.findPublishedConcertTicketTypes(concertId);

  assert.equal(findFirstCalls.length, 1);
  assert.deepEqual(cachedResponse, response);
});

test('public concert ticket types recovers corrupted cache and returns empty array for no active types', async () => {
  const concertId = '55555555-5555-4555-8555-555555555555';
  const deletedKeys: string[] = [];
  let cachedValue: string | null = '{not-json';
  let findFirstCalls = 0;

  const service = new ConcertsService(
    {
      concert: {
        findFirst: async () => {
          findFirstCalls += 1;
          return { ticketTypes: [] };
        },
      },
    } as never,
    {
      get: async () => cachedValue,
      set: async (_key: string, value: string) => {
        cachedValue = value;
      },
      del: async (key: string) => {
        deletedKeys.push(key);
        cachedValue = null;
      },
    } as never,
  );

  const response = await service.findPublishedConcertTicketTypes(concertId);

  assert.equal(findFirstCalls, 1);
  assert.deepEqual(deletedKeys, [`concerts:${concertId}:ticket-types`]);
  assert.deepEqual(response, []);
});

test('public concert ticket types throws not found when no published concert exists', async () => {
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
    () => service.findPublishedConcertTicketTypes('66666666-6666-4666-8666-666666666666'),
    NotFoundException,
  );
});

test('public concert ticket types hide cancelled concerts because only published concerts can expose ticket types', async () => {
  const findFirstCalls: PrismaConcertFindFirstTicketTypesArgs[] = [];
  const service = new ConcertsService(
    {
      concert: {
        findFirst: async (args: PrismaConcertFindFirstTicketTypesArgs) => {
          findFirstCalls.push(args);
          return null;
        },
      },
    } as never,
    {
      get: async () => null,
      set: async () => undefined,
      del: async () => undefined,
    } as never,
  );

  await assert.rejects(
    () => service.findPublishedConcertTicketTypes('66666666-6666-4666-8666-666666666667'),
    NotFoundException,
  );
  assert.equal(findFirstCalls.length, 1);
  assert.equal(findFirstCalls[0].where.status, ConcertStatus.PUBLISHED);
  assert.equal(
    findFirstCalls[0].select.ticketTypes.where.status,
    TicketTypeStatus.ACTIVE,
  );
});
