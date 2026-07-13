import * as assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  BadRequestException,
  ForbiddenException,
  PayloadTooLargeException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { BannerUploadService } from "./banner-upload.service";

test("valid image upload returns a stable backend banner URL", async () => {
  const uploaded: Array<{ key: string; mimeType: string; size: number }> = [];
  const service = createBannerUploadService({
    organizerAllowed: true,
    onUpload: async (key, buffer, mimeType) => {
      uploaded.push({ key, mimeType, size: buffer.length });
    },
  });

  const response = await service.upload("organizer-1", {
    originalname: "banner.jpg",
    mimetype: "image/jpeg",
    size: 1_024,
    buffer: Buffer.from("image-data"),
  });

  assert.match(
    response.bannerUrl,
    /^\/uploads\/banners\/[0-9a-f-]+\.jpg$/,
  );
  assert.equal(uploaded.length, 1);
  assert.match(uploaded[0].key, /^banners\/[0-9a-f-]+\.jpg$/);
  assert.equal(uploaded[0].mimeType, "image/jpeg");
});

test("oversized file throws 413", async () => {
  const service = createBannerUploadService({ organizerAllowed: true });

  await assert.rejects(
    () =>
      service.upload("organizer-1", {
        originalname: "banner.png",
        mimetype: "image/png",
        size: 5_242_881,
        buffer: Buffer.alloc(1),
      }),
    PayloadTooLargeException,
  );
});

test("non-image mime type throws 400", async () => {
  const service = createBannerUploadService({ organizerAllowed: true });

  await assert.rejects(
    () =>
      service.upload("organizer-1", {
        originalname: "banner.txt",
        mimetype: "text/plain",
        size: 128,
        buffer: Buffer.from("text"),
      }),
    BadRequestException,
  );
});

test("svg file is rejected with 400", async () => {
  const service = createBannerUploadService({ organizerAllowed: true });

  await assert.rejects(
    () =>
      service.upload("organizer-1", {
        originalname: "banner.svg",
        mimetype: "image/svg+xml",
        size: 128,
        buffer: Buffer.from("<svg />"),
      }),
    BadRequestException,
  );
});

test("missing file throws 400", async () => {
  const service = createBannerUploadService({ organizerAllowed: true });

  await assert.rejects(
    () => service.upload("organizer-1"),
    BadRequestException,
  );
});

test("non-organizer throws 403", async () => {
  const service = createBannerUploadService({ organizerAllowed: false });

  await assert.rejects(
    () =>
      service.upload("user-2", {
        originalname: "banner.webp",
        mimetype: "image/webp",
        size: 128,
        buffer: Buffer.from("image"),
      }),
    ForbiddenException,
  );
});

test("MinIO upload failure throws 503", async () => {
  const service = createBannerUploadService({
    organizerAllowed: true,
    onUpload: async () => {
      throw new Error("MinIO unavailable");
    },
  });

  await assert.rejects(
    () =>
      service.upload("organizer-1", {
        originalname: "banner.jpeg",
        mimetype: "image/jpeg",
        size: 128,
        buffer: Buffer.from("image"),
      }),
    ServiceUnavailableException,
  );
});

test("5 MB exactly succeeds and 5 MB plus one byte fails", async () => {
  const service = createBannerUploadService({ organizerAllowed: true });

  const exactFiveMb = await service.upload("organizer-1", {
    originalname: "banner.PNG",
    mimetype: "image/png",
    size: 5_242_880,
    buffer: Buffer.alloc(16),
  });

  assert.match(exactFiveMb.bannerUrl, /\.png$/);

  await assert.rejects(
    () =>
      service.upload("organizer-1", {
        originalname: "banner.png",
        mimetype: "image/png",
        size: 5_242_881,
        buffer: Buffer.alloc(16),
      }),
    PayloadTooLargeException,
  );
});

test("mismatched mime type and extension is rejected", async () => {
  const service = createBannerUploadService({ organizerAllowed: true });

  await assert.rejects(
    () =>
      service.upload("organizer-1", {
        originalname: "banner.jpeg",
        mimetype: "image/png",
        size: 128,
        buffer: Buffer.from("image"),
      }),
    BadRequestException,
  );
});

function createBannerUploadService(options: {
  organizerAllowed: boolean;
  onUpload?: (key: string, buffer: Buffer, mimeType: string) => Promise<void>;
}) {
  const prisma = {
    role: {
      findUnique: async () =>
        options.organizerAllowed ? { id: "role-organizer" } : { id: "role-organizer" },
    },
    userRole: {
      findFirst: async () =>
        options.organizerAllowed ? { userId: "organizer-1" } : null,
    },
  };
  const storage = {
    upload: async (key: string, buffer: Buffer, mimeType: string) => {
      await options.onUpload?.(key, buffer, mimeType);
    },
  };
  const config = {
    get: (key: string, fallback?: unknown) => {
      if (key === "BANNERS_MAX_FILE_SIZE") {
        return 5_242_880;
      }

      return fallback;
    },
  } as ConfigService;

  return new BannerUploadService(prisma as never, storage as never, config);
}
