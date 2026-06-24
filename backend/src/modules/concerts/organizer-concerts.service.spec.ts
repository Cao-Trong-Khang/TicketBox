import assert from "node:assert/strict";
import test from "node:test";
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from "@nestjs/common";
import { Concert, ConcertStatus, Role, UserRole } from "@prisma/client";
import { ROLE_CODES } from "../rbac/rbac.constants";
import { OrganizerConcertsService } from "./organizer-concerts.service";

type TestState = {
  concerts: Concert[];
  roles: Role[];
  userRoles: UserRole[];
};

test("organizer list returns only owned concerts ordered by createdAt descending", async () => {
  const organizerId = "00000000-0000-4000-8000-000000000001";
  const otherOrganizerId = "00000000-0000-4000-8000-000000000002";
  const state = createState({
    concerts: [
      createConcert({
        id: "11111111-1111-4111-8111-111111111111",
        organizerId,
        title: "Newer Draft",
        createdAt: new Date("2026-07-02T10:00:00.000Z"),
      }),
      createConcert({
        id: "22222222-2222-4222-8222-222222222222",
        organizerId,
        title: "Older Draft",
        createdAt: new Date("2026-07-01T10:00:00.000Z"),
      }),
      createConcert({
        id: "33333333-3333-4333-8333-333333333333",
        organizerId: otherOrganizerId,
        title: "Other Organizer Concert",
      }),
    ],
    userRoles: [createUserRole(organizerId, "role-organizer")],
  });
  const service = createService(state);

  const response = await service.listOwnedConcerts(organizerId);

  assert.deepEqual(
    response.map((concert) => concert.id),
    [
      "11111111-1111-4111-8111-111111111111",
      "22222222-2222-4222-8222-222222222222",
    ],
  );
  assert.equal(response[0].status, ConcertStatus.DRAFT);
});

test("non-organizer is forbidden from organizer concert endpoints", async () => {
  const service = createService(
    createState({
      userRoles: [],
    }),
  );

  await assert.rejects(
    () => service.listOwnedConcerts("00000000-0000-4000-8000-000000000003"),
    ForbiddenException,
  );
});

test("organizer create stores a DRAFT concert with organizer ownership and no ticket types", async () => {
  const organizerId = "00000000-0000-4000-8000-000000000001";
  const state = createState({
    userRoles: [createUserRole(organizerId, "role-organizer")],
  });
  const createdPayloads: Array<Record<string, unknown>> = [];
  const service = createService(state, {
    onCreate: ({ data }) => {
      createdPayloads.push(data as Record<string, unknown>);
    },
  });

  const response = await service.createConcert(organizerId, {
    title: "Organizer Draft Concert",
    artistName: "TicketBox Artist",
    description: "Draft description",
    venueName: "TicketBox Arena",
    venueAddress: "District 1",
    bannerUrl: "https://example.test/banner.jpg",
    seatingSvg: "<svg />",
    startsAt: "2026-08-01T12:00:00.000Z",
    endsAt: "2026-08-01T15:00:00.000Z",
  });

  assert.equal(createdPayloads.length, 1);
  assert.equal(createdPayloads[0].organizerId, organizerId);
  assert.equal(createdPayloads[0].status, ConcertStatus.DRAFT);
  assert.equal(createdPayloads[0].ticketTypes, undefined);
  assert.equal(response.status, ConcertStatus.DRAFT);
  assert.equal(response.venueAddress, "District 1");
});

test("organizer create rejects invalid date range", async () => {
  const organizerId = "00000000-0000-4000-8000-000000000001";
  const service = createService(
    createState({
      userRoles: [createUserRole(organizerId, "role-organizer")],
    }),
  );

  await assert.rejects(
    () =>
      service.createConcert(organizerId, {
        title: "Invalid Dates",
        artistName: "Artist",
        venueName: "Venue",
        venueAddress: "Address",
        startsAt: "2026-08-01T15:00:00.000Z",
        endsAt: "2026-08-01T12:00:00.000Z",
      }),
    BadRequestException,
  );
});

test("organizer detail returns 404 for missing or foreign concert", async () => {
  const organizerId = "00000000-0000-4000-8000-000000000001";
  const otherOrganizerId = "00000000-0000-4000-8000-000000000002";
  const service = createService(
    createState({
      concerts: [
        createConcert({
          id: "44444444-4444-4444-8444-444444444444",
          organizerId: otherOrganizerId,
        }),
      ],
      userRoles: [createUserRole(organizerId, "role-organizer")],
    }),
  );

  await assert.rejects(
    () =>
      service.getOwnedConcert(
        organizerId,
        "44444444-4444-4444-8444-444444444444",
      ),
    NotFoundException,
  );
});

test("organizer can update owned DRAFT concert and update rejects published concerts", async () => {
  const organizerId = "00000000-0000-4000-8000-000000000001";
  const draftConcertId = "55555555-5555-4555-8555-555555555555";
  const publishedConcertId = "66666666-6666-4666-8666-666666666666";
  const state = createState({
    concerts: [
      createConcert({
        id: draftConcertId,
        organizerId,
        title: "Original Draft",
        startsAt: new Date("2026-08-01T12:00:00.000Z"),
        endsAt: new Date("2026-08-01T15:00:00.000Z"),
      }),
      createConcert({
        id: publishedConcertId,
        organizerId,
        status: ConcertStatus.PUBLISHED,
      }),
    ],
    userRoles: [createUserRole(organizerId, "role-organizer")],
  });
  const service = createService(state);

  const updated = await service.updateOwnedConcert(
    organizerId,
    draftConcertId,
    {
      title: "Updated Draft",
      endsAt: "2026-08-01T16:00:00.000Z",
    },
  );

  assert.equal(updated.title, "Updated Draft");
  assert.equal(updated.endsAt, "2026-08-01T16:00:00.000Z");

  await assert.rejects(
    () =>
      service.updateOwnedConcert(organizerId, publishedConcertId, {
        title: "Nope",
      }),
    ConflictException,
  );
});

test("organizer update rejects invalid patch values and invalid date ranges", async () => {
  const organizerId = "00000000-0000-4000-8000-000000000001";
  const concertId = "77777777-7777-4777-8777-777777777777";
  const service = createService(
    createState({
      concerts: [createConcert({ id: concertId, organizerId })],
      userRoles: [createUserRole(organizerId, "role-organizer")],
    }),
  );

  await assert.rejects(
    () =>
      service.updateOwnedConcert(organizerId, concertId, {
        title: null as never,
      }),
    BadRequestException,
  );

  await assert.rejects(
    () =>
      service.updateOwnedConcert(organizerId, concertId, {
        startsAt: "2026-08-01T18:00:00.000Z",
        endsAt: "2026-08-01T17:00:00.000Z",
      }),
    BadRequestException,
  );
});

test("organizer publish sets concert to PUBLISHED and invalidates public cache keys", async () => {
  const organizerId = "00000000-0000-4000-8000-000000000001";
  const concertId = "88888888-8888-4888-8888-888888888888";
  const deletedKeys: string[] = [];
  const service = createService(
    createState({
      concerts: [
        createConcert({
          id: concertId,
          organizerId,
          title: "Ready to Publish",
          artistName: "Artist",
          venueName: "Venue",
          venueAddress: "Address",
          startsAt: new Date("2099-08-01T12:00:00.000Z"),
          endsAt: new Date("2099-08-01T15:00:00.000Z"),
        }),
      ],
      userRoles: [createUserRole(organizerId, "role-organizer")],
    }),
    {
      redis: {
        del: async (key: string) => {
          deletedKeys.push(key);
        },
      },
    },
  );

  const response = await service.publishOwnedConcert(organizerId, concertId);

  assert.equal(response.status, ConcertStatus.PUBLISHED);
  assert.deepEqual(deletedKeys, [
    "concerts:list:published",
    `concerts:detail:${concertId}`,
  ]);
});

test("organizer publish rejects incomplete or already published concerts", async () => {
  const organizerId = "00000000-0000-4000-8000-000000000001";
  const incompleteConcertId = "99999999-9999-4999-8999-999999999999";
  const publishedConcertId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const service = createService(
    createState({
      concerts: [
        createConcert({
          id: incompleteConcertId,
          organizerId,
          artistName: null,
          startsAt: new Date("2099-08-01T12:00:00.000Z"),
          endsAt: new Date("2099-08-01T15:00:00.000Z"),
        }),
        createConcert({
          id: publishedConcertId,
          organizerId,
          status: ConcertStatus.PUBLISHED,
          startsAt: new Date("2099-08-01T12:00:00.000Z"),
          endsAt: new Date("2099-08-01T15:00:00.000Z"),
        }),
      ],
      userRoles: [createUserRole(organizerId, "role-organizer")],
    }),
  );

  await assert.rejects(
    () => service.publishOwnedConcert(organizerId, incompleteConcertId),
    BadRequestException,
  );

  await assert.rejects(
    () => service.publishOwnedConcert(organizerId, publishedConcertId),
    ConflictException,
  );
});

test("organizer publish still succeeds when Redis invalidation fails", async () => {
  const organizerId = "00000000-0000-4000-8000-000000000001";
  const concertId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
  const service = createService(
    createState({
      concerts: [
        createConcert({
          id: concertId,
          organizerId,
          startsAt: new Date("2099-08-01T12:00:00.000Z"),
          endsAt: new Date("2099-08-01T15:00:00.000Z"),
        }),
      ],
      userRoles: [createUserRole(organizerId, "role-organizer")],
    }),
    {
      redis: {
        del: async () => {
          throw new Error("Redis unavailable");
        },
      },
    },
  );

  const response = await service.publishOwnedConcert(organizerId, concertId);

  assert.equal(response.status, ConcertStatus.PUBLISHED);
});

function createService(
  state: TestState,
  options?: {
    onCreate?: ({ data }: { data: unknown }) => void;
    redis?: {
      del?: (key: string) => Promise<void>;
    };
  },
): OrganizerConcertsService {
  const organizerRole = state.roles.find(
    (role) => role.code === ROLE_CODES.organizer,
  );
  assert.ok(organizerRole);

  const prisma = {
    role: {
      findUnique: async () => ({ id: organizerRole.id }),
    },
    userRole: {
      findFirst: async ({
        where,
      }: {
        where: { userId: string; roleId: string };
      }) =>
        state.userRoles.find(
          (userRole) =>
            userRole.userId === where.userId &&
            userRole.roleId === where.roleId,
        )
          ? { userId: where.userId }
          : null,
    },
    concert: {
      findMany: async ({ where }: { where: { organizerId: string } }) =>
        state.concerts
          .filter((concert) => concert.organizerId === where.organizerId)
          .sort(
            (left, right) =>
              right.createdAt.getTime() - left.createdAt.getTime(),
          )
          .map(toConcertListRecord),
      create: async ({ data }: { data: Record<string, unknown> }) => {
        options?.onCreate?.({ data });
        const now = new Date("2026-06-20T10:00:00.000Z");
        const createdConcert = createConcert({
          id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
          organizerId: data.organizerId as string,
          status: data.status as ConcertStatus,
          title: data.title as string,
          artistName: data.artistName as string,
          description: (data.description as string | null | undefined) ?? null,
          venueName: data.venueName as string,
          venueAddress: data.venueAddress as string,
          bannerUrl: (data.bannerUrl as string | null | undefined) ?? null,
          seatingSvg: (data.seatingSvg as string | null | undefined) ?? null,
          startsAt: data.startsAt as Date,
          endsAt: data.endsAt as Date,
          createdAt: now,
          updatedAt: now,
        });

        state.concerts.push(createdConcert);
        return toConcertDetailRecord(createdConcert);
      },
      findFirst: async ({
        where,
      }: {
        where: { id: string; organizerId: string };
      }) => {
        const concert = state.concerts.find(
          (candidate) =>
            candidate.id === where.id &&
            candidate.organizerId === where.organizerId,
        );

        return concert ? toConcertDetailRecord(concert) : null;
      },
      update: async ({
        where,
        data,
      }: {
        where: { id: string };
        data: Record<string, unknown>;
      }) => {
        const concert = state.concerts.find(
          (candidate) => candidate.id === where.id,
        );
        assert.ok(concert);

        if (data.title !== undefined) {
          concert.title = data.title as string;
        }
        if (data.artistName !== undefined) {
          concert.artistName = data.artistName as string;
        }
        if (data.description !== undefined) {
          concert.description = data.description as string | null;
        }
        if (data.venueName !== undefined) {
          concert.venueName = data.venueName as string;
        }
        if (data.venueAddress !== undefined) {
          concert.venueAddress = data.venueAddress as string;
        }
        if (data.bannerUrl !== undefined) {
          concert.bannerUrl = data.bannerUrl as string | null;
        }
        if (data.seatingSvg !== undefined) {
          concert.seatingSvg = data.seatingSvg as string | null;
        }
        if (data.startsAt !== undefined) {
          concert.startsAt = data.startsAt as Date;
        }
        if (data.endsAt !== undefined) {
          concert.endsAt = data.endsAt as Date | null;
        }
        if (data.status !== undefined) {
          concert.status = data.status as ConcertStatus;
        }

        concert.updatedAt = new Date("2026-06-20T11:00:00.000Z");

        return toConcertDetailRecord(concert);
      },
    },
  };
  const redis = {
    del: options?.redis?.del ?? (async () => undefined),
  };

  return new OrganizerConcertsService(prisma as never, redis as never);
}

function createState(overrides?: Partial<TestState>): TestState {
  return {
    concerts: overrides?.concerts ?? [],
    roles: overrides?.roles ?? [
      {
        id: "role-organizer",
        code: ROLE_CODES.organizer,
        name: "Organizer",
        createdAt: new Date("2026-06-20T00:00:00.000Z"),
        updatedAt: new Date("2026-06-20T00:00:00.000Z"),
      },
    ],
    userRoles: overrides?.userRoles ?? [],
  };
}

function createUserRole(userId: string, roleId: string): UserRole {
  return {
    userId,
    roleId,
    createdAt: new Date("2026-06-20T00:00:00.000Z"),
  };
}

function createConcert(overrides?: Partial<Concert>): Concert {
  return {
    id: overrides?.id ?? "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
    organizerId:
      overrides?.organizerId ?? "00000000-0000-4000-8000-000000000001",
    title: overrides?.title ?? "Draft Concert",
    artistName:
      overrides && "artistName" in overrides
        ? (overrides.artistName ?? null)
        : "TicketBox Artist",
    description:
      overrides && "description" in overrides
        ? (overrides.description ?? null)
        : "Organizer draft description",
    venueName: overrides?.venueName ?? "TicketBox Hall",
    venueAddress:
      overrides && "venueAddress" in overrides
        ? (overrides.venueAddress ?? null)
        : "District 1",
    bannerUrl:
      overrides && "bannerUrl" in overrides
        ? (overrides.bannerUrl ?? null)
        : "https://example.test/banner.jpg",
    seatingSvg:
      overrides && "seatingSvg" in overrides
        ? (overrides.seatingSvg ?? null)
        : "<svg />",
    status: overrides?.status ?? ConcertStatus.DRAFT,
    startsAt: overrides?.startsAt ?? new Date("2099-08-01T12:00:00.000Z"),
    endsAt:
      overrides && "endsAt" in overrides
        ? (overrides.endsAt ?? null)
        : new Date("2099-08-01T15:00:00.000Z"),
    createdAt: overrides?.createdAt ?? new Date("2026-06-20T09:00:00.000Z"),
    updatedAt: overrides?.updatedAt ?? new Date("2026-06-20T09:00:00.000Z"),
  };
}

function toConcertListRecord(concert: Concert) {
  return {
    id: concert.id,
    status: concert.status,
    title: concert.title,
    artistName: concert.artistName,
    venueName: concert.venueName,
    startsAt: concert.startsAt,
    endsAt: concert.endsAt,
    createdAt: concert.createdAt,
    updatedAt: concert.updatedAt,
  };
}

function toConcertDetailRecord(concert: Concert) {
  return {
    id: concert.id,
    organizerId: concert.organizerId,
    status: concert.status,
    title: concert.title,
    artistName: concert.artistName,
    description: concert.description,
    venueName: concert.venueName,
    venueAddress: concert.venueAddress,
    bannerUrl: concert.bannerUrl,
    seatingSvg: concert.seatingSvg,
    startsAt: concert.startsAt,
    endsAt: concert.endsAt,
    createdAt: concert.createdAt,
    updatedAt: concert.updatedAt,
  };
}
