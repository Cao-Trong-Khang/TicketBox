import * as assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from "@nestjs/common";
import { ConcertStatus, TicketType, TicketTypeStatus } from "@prisma/client";
import { OrganizerConcertDetailQueryResult } from "./organizer-concerts.service";
import { OrganizerTicketTypesService } from "./organizer-ticket-types.service";

type TicketTypeState = {
  concert: OrganizerConcertDetailQueryResult;
  ticketTypes: TicketType[];
  organizerAllowed: boolean;
};

test("organizer can list ticket types for owned concert ordered by price then code", async () => {
  const service = createService({
    organizerAllowed: true,
    concert: createOwnedConcertRecord(),
    ticketTypes: [
      createTicketType({
        id: "11111111-1111-4111-8111-111111111111",
        code: "VIP",
        priceVnd: 2000000,
      }),
      createTicketType({
        id: "22222222-2222-4222-8222-222222222222",
        code: "GA",
        priceVnd: 800000,
      }),
      createTicketType({
        id: "33333333-3333-4333-8333-333333333333",
        code: "CAT1",
        priceVnd: 800000,
      }),
    ],
  });

  const response = await service.listOwnedConcertTicketTypes(
    "00000000-0000-4000-8000-000000000001",
    "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  );

  assert.deepEqual(
    response.map((ticketType) => ticketType.id),
    [
      "33333333-3333-4333-8333-333333333333",
      "22222222-2222-4222-8222-222222222222",
      "11111111-1111-4111-8111-111111111111",
    ],
  );
  assert.equal(response[0].availableQuantity, 100);
});

test("non-organizer is forbidden from organizer ticket-type endpoints", async () => {
  const service = createService({
    organizerAllowed: false,
    concert: createOwnedConcertRecord(),
    ticketTypes: [],
  });

  await assert.rejects(
    () =>
      service.listOwnedConcertTicketTypes(
        "00000000-0000-4000-8000-000000000001",
        "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      ),
    ForbiddenException,
  );
});

test("organizer create stores an INACTIVE ticket type and invalidates public ticket-type cache", async () => {
  const deletedKeys: string[] = [];
  const service = createService(
    {
      organizerAllowed: true,
      concert: createOwnedConcertRecord(),
      ticketTypes: [],
    },
    {
      redis: {
        del: async (key: string) => {
          deletedKeys.push(key);
        },
      },
    },
  );

  const response = await service.createOwnedConcertTicketType(
    "00000000-0000-4000-8000-000000000001",
    "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    {
      code: "EARLY",
      name: "Early Bird",
      priceVnd: 500000,
      totalQuantity: 50,
      perUserLimit: 2,
      saleStartAt: "2026-08-01T00:00:00.000Z",
      saleEndAt: "2026-08-02T00:00:00.000Z",
    },
  );

  assert.equal(response.status, TicketTypeStatus.INACTIVE);
  assert.deepEqual(deletedKeys, [
    "concerts:aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa:ticket-types",
  ]);
});

test("duplicate code in the same concert returns 409 on create", async () => {
  const service = createService({
    organizerAllowed: true,
    concert: createOwnedConcertRecord(),
    ticketTypes: [createTicketType({ code: "VIP" })],
  });

  await assert.rejects(
    () =>
      service.createOwnedConcertTicketType(
        "00000000-0000-4000-8000-000000000001",
        "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        {
          code: "VIP",
          name: "VIP Clone",
          priceVnd: 1000000,
          totalQuantity: 10,
          perUserLimit: 2,
        },
      ),
    ConflictException,
  );
});

test("create validates per-user limit and sale window", async () => {
  const service = createService({
    organizerAllowed: true,
    concert: createOwnedConcertRecord(),
    ticketTypes: [],
  });

  await assert.rejects(
    () =>
      service.createOwnedConcertTicketType(
        "00000000-0000-4000-8000-000000000001",
        "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        {
          code: "BAD",
          name: "Bad Limits",
          priceVnd: 1000000,
          totalQuantity: 2,
          perUserLimit: 3,
        },
      ),
    BadRequestException,
  );

  await assert.rejects(
    () =>
      service.createOwnedConcertTicketType(
        "00000000-0000-4000-8000-000000000001",
        "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        {
          code: "BAD2",
          name: "Bad Window",
          priceVnd: 1000000,
          totalQuantity: 5,
          perUserLimit: 1,
          saleStartAt: "2026-08-02T00:00:00.000Z",
          saleEndAt: "2026-08-01T00:00:00.000Z",
        },
      ),
    BadRequestException,
  );
});

test("update merges existing values, rejects invalid inventory reductions, and enforces code uniqueness", async () => {
  const service = createService({
    organizerAllowed: true,
    concert: createOwnedConcertRecord(),
    ticketTypes: [
      createTicketType({
        id: "11111111-1111-4111-8111-111111111111",
        code: "VIP",
        totalQuantity: 100,
        reservedQuantity: 10,
        soldQuantity: 20,
        perUserLimit: 2,
      }),
      createTicketType({
        id: "22222222-2222-4222-8222-222222222222",
        code: "GA",
      }),
    ],
  });

  await assert.rejects(
    () =>
      service.updateOwnedConcertTicketType(
        "00000000-0000-4000-8000-000000000001",
        "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        "11111111-1111-4111-8111-111111111111",
        {
          totalQuantity: 29,
        },
      ),
    ConflictException,
  );

  await assert.rejects(
    () =>
      service.updateOwnedConcertTicketType(
        "00000000-0000-4000-8000-000000000001",
        "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        "11111111-1111-4111-8111-111111111111",
        {
          code: "GA",
        },
      ),
    ConflictException,
  );

  const updated = await service.updateOwnedConcertTicketType(
    "00000000-0000-4000-8000-000000000001",
    "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    "11111111-1111-4111-8111-111111111111",
    {
      totalQuantity: 150,
      perUserLimit: 3,
      saleStartAt: "2026-08-01T00:00:00.000Z",
      saleEndAt: "2026-08-03T00:00:00.000Z",
    },
  );

  assert.equal(updated.totalQuantity, 150);
  assert.equal(updated.perUserLimit, 3);
  assert.equal(updated.availableQuantity, 120);
});

test("ticket type lookup returns 404 for foreign or missing ticket type", async () => {
  const service = createService({
    organizerAllowed: true,
    concert: createOwnedConcertRecord(),
    ticketTypes: [],
  });

  await assert.rejects(
    () =>
      service.updateOwnedConcertTicketType(
        "00000000-0000-4000-8000-000000000001",
        "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        "missing-ticket-type",
        {
          name: "Nope",
        },
      ),
    NotFoundException,
  );
});

test("activate and deactivate toggle status, reject repeated transitions, and keep cache invalidation non-fatal", async () => {
  const service = createService(
    {
      organizerAllowed: true,
      concert: createOwnedConcertRecord(),
      ticketTypes: [
        createTicketType({
          id: "11111111-1111-4111-8111-111111111111",
          status: TicketTypeStatus.INACTIVE,
        }),
        createTicketType({
          id: "22222222-2222-4222-8222-222222222222",
          status: TicketTypeStatus.ACTIVE,
          code: "GA",
        }),
      ],
    },
    {
      redis: {
        del: async () => {
          throw new Error("Redis unavailable");
        },
      },
    },
  );

  const activated = await service.activateOwnedConcertTicketType(
    "00000000-0000-4000-8000-000000000001",
    "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    "11111111-1111-4111-8111-111111111111",
  );
  assert.equal(activated.status, TicketTypeStatus.ACTIVE);

  await assert.rejects(
    () =>
      service.activateOwnedConcertTicketType(
        "00000000-0000-4000-8000-000000000001",
        "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        "11111111-1111-4111-8111-111111111111",
      ),
    ConflictException,
  );

  const deactivated = await service.deactivateOwnedConcertTicketType(
    "00000000-0000-4000-8000-000000000001",
    "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    "22222222-2222-4222-8222-222222222222",
  );
  assert.equal(deactivated.status, TicketTypeStatus.INACTIVE);

  await assert.rejects(
    () =>
      service.deactivateOwnedConcertTicketType(
        "00000000-0000-4000-8000-000000000001",
        "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        "22222222-2222-4222-8222-222222222222",
      ),
    ConflictException,
  );
});

function createService(
  state: TicketTypeState,
  options?: {
    redis?: {
      del?: (key: string) => Promise<void>;
    };
  },
): OrganizerTicketTypesService {
  const prisma = {
    ticketType: {
      findMany: async ({ where }: { where: { concertId: string } }) =>
        state.ticketTypes
          .filter((ticketType) => ticketType.concertId === where.concertId)
          .sort((left, right) => {
            if (left.priceVnd !== right.priceVnd) {
              return left.priceVnd - right.priceVnd;
            }

            return left.code.localeCompare(right.code);
          })
          .map(toTicketTypeRecord),
      findFirst: async ({
        where,
      }: {
        where: {
          id?: string | { not: string };
          concertId: string;
          code?: string;
        };
      }) => {
        const ticketType = state.ticketTypes.find((candidate) => {
          if (candidate.concertId !== where.concertId) {
            return false;
          }
          if (where.id) {
            if (typeof where.id === "string" && candidate.id !== where.id) {
              return false;
            }

            if (
              typeof where.id === "object" &&
              "not" in where.id &&
              candidate.id === where.id.not
            ) {
              return false;
            }
          }
          if (where.code && candidate.code !== where.code) {
            return false;
          }

          return true;
        });

        return ticketType ? toTicketTypeRecord(ticketType) : null;
      },
      create: async ({ data }: { data: Record<string, unknown> }) => {
        const now = new Date("2026-06-24T10:00:00.000Z");
        const ticketType = createTicketType({
          id: "99999999-9999-4999-8999-999999999999",
          concertId: data.concertId as string,
          code: data.code as string,
          name: data.name as string,
          priceVnd: data.priceVnd as number,
          totalQuantity: data.totalQuantity as number,
          perUserLimit: data.perUserLimit as number,
          saleStartAt:
            (data.saleStartAt as Date | undefined) ??
            new Date("2026-06-24T10:00:00.000Z"),
          saleEndAt: (data.saleEndAt as Date | null | undefined) ?? null,
          status: data.status as TicketTypeStatus,
          createdAt: now,
          updatedAt: now,
        });
        state.ticketTypes.push(ticketType);
        return toTicketTypeRecord(ticketType);
      },
      update: async ({
        where,
        data,
      }: {
        where: { id: string };
        data: Record<string, unknown>;
      }) => {
        const ticketType = state.ticketTypes.find(
          (candidate) => candidate.id === where.id,
        );
        assert.ok(ticketType);

        if (data.code !== undefined) {
          ticketType.code = data.code as string;
        }
        if (data.name !== undefined) {
          ticketType.name = data.name as string;
        }
        if (data.priceVnd !== undefined) {
          ticketType.priceVnd = data.priceVnd as number;
        }
        if (data.totalQuantity !== undefined) {
          ticketType.totalQuantity = data.totalQuantity as number;
        }
        if (data.perUserLimit !== undefined) {
          ticketType.perUserLimit = data.perUserLimit as number;
        }
        if (data.saleStartAt !== undefined) {
          ticketType.saleStartAt = data.saleStartAt as Date;
        }
        if (data.saleEndAt !== undefined) {
          ticketType.saleEndAt = data.saleEndAt as Date | null;
        }
        if (data.status !== undefined) {
          ticketType.status = data.status as TicketTypeStatus;
        }

        ticketType.updatedAt = new Date("2026-06-24T11:00:00.000Z");
        return toTicketTypeRecord(ticketType);
      },
    },
  };
  const redis = {
    del: options?.redis?.del ?? (async () => undefined),
  };
  const organizerConcertsService = {
    ensureOrganizerRole: async () => {
      if (!state.organizerAllowed) {
        throw new ForbiddenException("Organizer access is required");
      }
    },
    findOwnedConcertOrThrow: async () => state.concert,
  };

  return new OrganizerTicketTypesService(
    prisma as never,
    redis as never,
    organizerConcertsService as never,
  );
}

function createOwnedConcertRecord(): OrganizerConcertDetailQueryResult {
  return {
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    organizerId: "00000000-0000-4000-8000-000000000001",
    status: ConcertStatus.DRAFT,
    title: "Organizer Concert",
    artistName: "TicketBox Artist",
    description: "Description",
    venueName: "Venue",
    venueAddress: "Address",
    bannerUrl: null,
    seatingSvg: null,
    startsAt: new Date("2099-08-01T12:00:00.000Z"),
    endsAt: new Date("2099-08-01T15:00:00.000Z"),
    performanceStartAt: new Date("2099-08-01T19:00:00.000Z"),
    createdAt: new Date("2026-06-24T09:00:00.000Z"),
    updatedAt: new Date("2026-06-24T09:00:00.000Z"),
  };
}

function createTicketType(overrides?: Partial<TicketType>): TicketType {
  return {
    id: overrides?.id ?? "88888888-8888-4888-8888-888888888888",
    concertId: overrides?.concertId ?? "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    code: overrides?.code ?? "VIP",
    name: overrides?.name ?? "VIP",
    priceVnd: overrides?.priceVnd ?? 1000000,
    totalQuantity: overrides?.totalQuantity ?? 100,
    reservedQuantity: overrides?.reservedQuantity ?? 0,
    soldQuantity: overrides?.soldQuantity ?? 0,
    perUserLimit: overrides?.perUserLimit ?? 2,
    saleStartAt:
      overrides && "saleStartAt" in overrides
        ? (overrides.saleStartAt ??
          new Date("2026-06-24T09:00:00.000Z"))
        : new Date("2026-06-24T09:00:00.000Z"),
    saleEndAt:
      overrides && "saleEndAt" in overrides ? (overrides.saleEndAt ?? null) : null,
    status: overrides?.status ?? TicketTypeStatus.INACTIVE,
    createdAt: overrides?.createdAt ?? new Date("2026-06-24T09:00:00.000Z"),
    updatedAt: overrides?.updatedAt ?? new Date("2026-06-24T09:00:00.000Z"),
  };
}

function toTicketTypeRecord(ticketType: TicketType) {
  return {
    id: ticketType.id,
    concertId: ticketType.concertId,
    code: ticketType.code,
    name: ticketType.name,
    priceVnd: ticketType.priceVnd,
    totalQuantity: ticketType.totalQuantity,
    reservedQuantity: ticketType.reservedQuantity,
    soldQuantity: ticketType.soldQuantity,
    perUserLimit: ticketType.perUserLimit,
    saleStartAt: ticketType.saleStartAt,
    saleEndAt: ticketType.saleEndAt,
    status: ticketType.status,
    createdAt: ticketType.createdAt,
    updatedAt: ticketType.updatedAt,
  };
}
