import * as assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  INestApplication,
  NotFoundException,
  ValidationPipe,
} from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { Test } from "@nestjs/testing";
import * as jwt from "jsonwebtoken";
import request = require('supertest');
import { PrismaService } from "../../prisma/prisma.service";
import { AuthModule } from "../auth/auth.module";
import { RedisCacheService } from "../redis-cache/redis-cache.service";
import { PermissionService } from "../rbac/permission.service";
import { ConcertsModule } from "./concerts.module";
import { OrganizerConcertsService } from "./organizer-concerts.service";

test("GET /organizer/concerts/:id/revenue returns 401 without auth", async () => {
  const app = await createOrganizerConcertsTestApp({
    getOwnedConcertRevenue: async () => {
      throw new Error("should not be called");
    },
  });

  try {
    await request(app.getHttpServer())
      .get("/organizer/concerts/11111111-1111-4111-8111-111111111111/revenue")
      .expect(401);
  } finally {
    await app.close();
  }
});

test("GET /organizer/concerts/:id/revenue returns owned organizer revenue payload", async () => {
  const app = await createOrganizerConcertsTestApp({
    getOwnedConcertRevenue: async (organizerId: string, concertId: string) => ({
      concert: {
        id: concertId,
        status: "PUBLISHED",
        lifecycleStatus: "UPCOMING",
        title: "Revenue Concert",
        artistName: "Artist",
        venueName: "Venue",
        venueAddress: "Address",
        bannerUrl: "/uploads/banners/revenue.jpg",
        startsAt: "2099-08-01T12:00:00.000Z",
        endsAt: "2099-08-01T15:00:00.000Z",
        performanceStartAt: "2099-08-01T19:00:00.000Z",
      },
      summary: {
        totalRevenueVnd: 4500000,
        totalSoldQuantity: 10,
        totalReservedQuantity: 2,
        totalAvailableQuantity: 88,
        totalTicketQuantity: 100,
        soldRate: 0.1,
        paidOrderCount: 3,
      },
      ticketTypes: [
        {
          id: "ticket-type-1",
          code: "VIP",
          name: "VIP",
          priceVnd: 1500000,
          totalQuantity: 100,
          reservedQuantity: 2,
          soldQuantity: 10,
          availableQuantity: 88,
          revenueVnd: 4500000,
          soldRate: 0.1,
          status: "ACTIVE",
        },
      ],
      requestedBy: organizerId,
    }),
  });

  try {
    const response = await request(app.getHttpServer())
      .get("/organizer/concerts/11111111-1111-4111-8111-111111111111/revenue")
      .set("Authorization", `Bearer ${createAccessToken("organizer-1")}`)
      .expect(200);

    assert.equal(
      response.body.concert.id,
      "11111111-1111-4111-8111-111111111111",
    );
    assert.equal(response.body.summary.totalRevenueVnd, 4500000);
    assert.equal(response.body.ticketTypes[0].code, "VIP");
  } finally {
    await app.close();
  }
});

test("GET /organizer/concerts/:id/revenue returns 404 for foreign or missing concert", async () => {
  const app = await createOrganizerConcertsTestApp({
    getOwnedConcertRevenue: async () => {
      throw new NotFoundException("Concert not found");
    },
  });

  try {
    await request(app.getHttpServer())
      .get("/organizer/concerts/22222222-2222-4222-8222-222222222222/revenue")
      .set("Authorization", `Bearer ${createAccessToken("organizer-1")}`)
      .expect(404);
  } finally {
    await app.close();
  }
});

async function createOrganizerConcertsTestApp(
  organizerConcertsService: Partial<OrganizerConcertsService>,
): Promise<INestApplication> {
  process.env.JWT_ACCESS_SECRET = "test-jwt-secret";
  process.env.JWT_ACCESS_TOKEN_TTL = "1h";

  const moduleRef = await Test.createTestingModule({
    imports: [
      ConfigModule.forRoot({
        isGlobal: true,
      }),
      AuthModule,
      ConcertsModule,
    ],
  })
    .overrideProvider(PrismaService)
    .useValue({})
    .overrideProvider(RedisCacheService)
    .useValue({
      del: async () => undefined,
    })
    .overrideProvider(PermissionService)
    .useValue({ userHasPermissions: async () => true })
    .overrideProvider(OrganizerConcertsService)
    .useValue(organizerConcertsService)
    .compile();

  const app = moduleRef.createNestApplication();
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );
  await app.init();

  return app;
}

function createAccessToken(userId: string): string {
  return jwt.sign(
    {
      sub: userId,
      email: `${userId}@ticketbox.test`,
    },
    "test-jwt-secret",
    {
      expiresIn: "1h",
    },
  );
}
