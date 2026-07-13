import * as assert from 'node:assert/strict';
import { test } from 'node:test';
import { BadRequestException, ForbiddenException, INestApplication, NotFoundException, ServiceUnavailableException, ValidationPipe } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { Test } from "@nestjs/testing";
import * as jwt from "jsonwebtoken";
import request = require('supertest');
import { PrismaService } from "../../prisma/prisma.service";
import { AuthModule } from "../auth/auth.module";
import { RedisCacheService } from "../redis-cache/redis-cache.service";
import { PermissionService } from "../rbac/permission.service";
import { BannerDownloadService } from "./banner-download.service";
import { BannerUploadService } from "./banner-upload.service";
import { ConcertsModule } from "./concerts.module";

test("authenticated organizer POST /organizer/concerts/banners with valid file returns 201 bannerUrl", async () => {
  const app = await createBannersTestApp({
    bannerUploadService: {
      upload: async () => ({
        bannerUrl: "/uploads/banners/test-banner.jpg",
      }),
    },
  });

  try {
    const response = await request(app.getHttpServer())
      .post("/organizer/concerts/banners")
      .set("Authorization", `Bearer ${createAccessToken("organizer-1")}`)
      .attach("file", Buffer.from("fake-image"), {
        filename: "banner.jpg",
        contentType: "image/jpeg",
      })
      .expect(201);

    assert.deepEqual(response.body, {
      bannerUrl: "/uploads/banners/test-banner.jpg",
    });
  } finally {
    await app.close();
  }
});

test("unauthenticated upload returns 401", async () => {
  const app = await createBannersTestApp({
    bannerUploadService: {
      upload: async () => ({
        bannerUrl: "/uploads/banners/test-banner.jpg",
      }),
    },
  });

  try {
    await request(app.getHttpServer())
      .post("/organizer/concerts/banners")
      .attach("file", Buffer.from("fake-image"), {
        filename: "banner.jpg",
        contentType: "image/jpeg",
      })
      .expect(401);
  } finally {
    await app.close();
  }
});

test("non-organizer upload returns 403", async () => {
  const app = await createBannersTestApp({
    bannerUploadService: {
      upload: async () => {
        throw new ForbiddenException("Organizer access is required");
      },
    },
  });

  try {
    await request(app.getHttpServer())
      .post("/organizer/concerts/banners")
      .set("Authorization", `Bearer ${createAccessToken("audience-1")}`)
      .attach("file", Buffer.from("fake-image"), {
        filename: "banner.jpg",
        contentType: "image/jpeg",
      })
      .expect(403);
  } finally {
    await app.close();
  }
});

test("invalid file upload returns 400", async () => {
  const app = await createBannersTestApp({
    bannerUploadService: {
      upload: async () => {
        throw new BadRequestException("Invalid file type");
      },
    },
  });

  try {
    await request(app.getHttpServer())
      .post("/organizer/concerts/banners")
      .set("Authorization", `Bearer ${createAccessToken("organizer-1")}`)
      .attach("file", Buffer.from("<svg />"), {
        filename: "banner.svg",
        contentType: "image/svg+xml",
      })
      .expect(400);
  } finally {
    await app.close();
  }
});

test("GET /uploads/banners/:filename returns public image data with cache headers", async () => {
  const app = await createBannersTestApp({
    bannerDownloadService: {
      getPublicBanner: async () => ({
        buffer: Buffer.from("image-data"),
        mimeType: "image/jpeg",
      }),
    },
  });

  try {
    const response = await request(app.getHttpServer())
      .get("/uploads/banners/123e4567-e89b-42d3-a456-426614174000.jpg")
      .expect(200);

    assert.equal(response.headers["cache-control"], "public, max-age=86400");
    assert.equal(response.headers["content-type"], "image/jpeg");
    assert.deepEqual(response.body, Buffer.from("image-data"));
  } finally {
    await app.close();
  }
});

test("GET /uploads/banners/nonexistent.jpg returns 404 without auth", async () => {
  const app = await createBannersTestApp({
    bannerDownloadService: {
      getPublicBanner: async () => {
        throw new NotFoundException("Banner not found");
      },
    },
  });

  try {
    await request(app.getHttpServer())
      .get("/uploads/banners/123e4567-e89b-42d3-a456-426614174001.jpg")
      .expect(404);
  } finally {
    await app.close();
  }
});

test("GET /uploads/banners/:filename returns 503 when storage is unavailable", async () => {
  const app = await createBannersTestApp({
    bannerDownloadService: {
      getPublicBanner: async () => {
        throw new ServiceUnavailableException(
          "Banner image is unavailable right now",
        );
      },
    },
  });

  try {
    await request(app.getHttpServer())
      .get("/uploads/banners/123e4567-e89b-42d3-a456-426614174002.jpg")
      .expect(503);
  } finally {
    await app.close();
  }
});

async function createBannersTestApp(options: {
  bannerUploadService?: Partial<BannerUploadService>;
  bannerDownloadService?: Partial<BannerDownloadService>;
}): Promise<INestApplication> {
  process.env.JWT_ACCESS_SECRET = "test-jwt-secret";
  process.env.JWT_ACCESS_TOKEN_TTL = "1h";
  process.env.BANNERS_CACHE_MAX_AGE = "86400";

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
    .overrideProvider(BannerUploadService)
    .useValue(options.bannerUploadService ?? { upload: async () => ({ bannerUrl: "/uploads/banners/fallback.jpg" }) })
    .overrideProvider(BannerDownloadService)
    .useValue(options.bannerDownloadService ?? { getPublicBanner: async () => ({ buffer: Buffer.from("ok"), mimeType: "image/jpeg" }) })
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
