import {
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { BannerStorageService, BannerStorageTimeoutError } from "./banner-storage.service";

const BANNER_FILENAME_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(jpg|jpeg|png|webp)$/;

@Injectable()
export class BannerDownloadService {
  constructor(private readonly storage: BannerStorageService) {}

  async getPublicBanner(
    filename: string,
  ): Promise<{ buffer: Buffer; mimeType: string }> {
    this.assertValidFilename(filename);

    try {
      const buffer = await this.storage.download(`banners/${filename}`);

      return {
        buffer,
        mimeType: getBannerMimeType(filename),
      };
    } catch (error) {
      if (isNotFoundError(error)) {
        throw new NotFoundException("Banner not found");
      }

      if (error instanceof BannerStorageTimeoutError || error instanceof Error) {
        throw new ServiceUnavailableException(
          "Banner image is unavailable right now",
        );
      }

      throw error;
    }
  }

  private assertValidFilename(filename: string): void {
    if (!BANNER_FILENAME_PATTERN.test(filename)) {
      throw new NotFoundException("Banner not found");
    }
  }
}

function isNotFoundError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  const code = "code" in error ? (error as { code?: string }).code : undefined;

  return (
    code === "NoSuchKey" ||
    code === "NoSuchObject" ||
    code === "NotFound" ||
    error.message.includes("not found")
  );
}

function getBannerMimeType(filename: string): string {
  if (filename.endsWith(".png")) {
    return "image/png";
  }

  if (filename.endsWith(".webp")) {
    return "image/webp";
  }

  return "image/jpeg";
}
