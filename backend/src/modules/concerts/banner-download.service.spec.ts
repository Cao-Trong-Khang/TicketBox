import * as assert from "node:assert/strict";
import { test } from "node:test";
import { NotFoundException } from "@nestjs/common";
import { BannerDownloadService } from "./banner-download.service";

const FILENAME = "123e4567-e89b-42d3-a456-426614174000.png";

test("banner download serves database-backed banners before object storage", async () => {
  let storageDownloads = 0;
  const service = new BannerDownloadService(
    {
      download: async () => {
        storageDownloads += 1;
        return Buffer.from("object-storage");
      },
    } as never,
    {
      download: async () => ({
        buffer: Buffer.from("database-storage"),
        mimeType: "image/png",
      }),
    } as never,
  );

  const response = await service.getPublicBanner(FILENAME);

  assert.deepEqual(response.buffer, Buffer.from("database-storage"));
  assert.equal(response.mimeType, "image/png");
  assert.equal(storageDownloads, 0);
});

test("banner download falls back to object storage when database has no row", async () => {
  const service = new BannerDownloadService(
    {
      download: async () => Buffer.from("object-storage"),
    } as never,
    {
      download: async () => null,
    } as never,
  );

  const response = await service.getPublicBanner(FILENAME);

  assert.deepEqual(response.buffer, Buffer.from("object-storage"));
  assert.equal(response.mimeType, "image/png");
});

test("banner download rejects invalid filenames before storage lookup", async () => {
  let databaseDownloads = 0;
  const service = new BannerDownloadService(
    {
      download: async () => Buffer.from("object-storage"),
    } as never,
    {
      download: async () => {
        databaseDownloads += 1;
        return null;
      },
    } as never,
  );

  await assert.rejects(
    () => service.getPublicBanner("../bad.png"),
    NotFoundException,
  );
  assert.equal(databaseDownloads, 0);
});
