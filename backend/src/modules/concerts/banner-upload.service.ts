import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  PayloadTooLargeException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { randomUUID } from "node:crypto";
import { extname } from "node:path";
import { getBannersConfig } from "../../config/app.config";
import { PrismaService } from "../../prisma/prisma.service";
import { ROLE_CODES } from "../rbac/rbac.constants";
import { BannerDatabaseStorageService } from "./banner-database-storage.service";
import { BannerStorageService, BannerStorageTimeoutError } from "./banner-storage.service";

export const DEFAULT_BANNER_MAX_FILE_SIZE = 5_242_880;
const ALLOWED_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const ALLOWED_EXTENSIONS = new Set(["jpg", "jpeg", "png", "webp"]);
const MIME_TYPES_BY_EXTENSION: Record<string, string[]> = {
  jpg: ["image/jpeg"],
  jpeg: ["image/jpeg"],
  png: ["image/png"],
  webp: ["image/webp"],
};

export type UploadedBannerFile = {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
};

@Injectable()
export class BannerUploadService {
  private readonly maxFileSize: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: BannerStorageService,
    private readonly databaseStorage: BannerDatabaseStorageService,
    configService: ConfigService,
  ) {
    this.maxFileSize = getBannersConfig(configService).maxFileSize;
  }

  async upload(
    organizerId: string,
    file?: UploadedBannerFile,
  ): Promise<{ bannerUrl: string }> {
    await this.ensureOrganizerRole(organizerId);

    if (!file) {
      throw new BadRequestException("Banner file is required");
    }

    const normalizedMimeType = this.validateMimeType(file.mimetype);
    const extension = this.validateExtension(file.originalname);
    this.assertMimeTypeMatchesExtension(normalizedMimeType, extension);
    this.validateSize(file.size);

    const fileName = `${randomUUID()}.${extension}`;
    const objectKey = `banners/${fileName}`;

    try {
      await this.storage.upload(objectKey, file.buffer, normalizedMimeType);
    } catch (error) {
      if (error instanceof BannerStorageTimeoutError || error instanceof Error) {
        try {
          await this.databaseStorage.upload(
            fileName,
            file.buffer,
            normalizedMimeType,
          );
        } catch {
          throw new ServiceUnavailableException(
            "Banner upload is unavailable right now",
          );
        }
      } else {
        throw error;
      }
    }

    return { bannerUrl: `/uploads/banners/${fileName}` };
  }

  private async ensureOrganizerRole(userId: string): Promise<void> {
    const organizerRole = await this.prisma.role.findUnique({
      where: {
        code: ROLE_CODES.organizer,
      },
      select: {
        id: true,
      },
    });

    if (!organizerRole) {
      throw new ForbiddenException("Organizer role is not configured");
    }

    const userRole = await this.prisma.userRole.findFirst({
      where: {
        userId,
        roleId: organizerRole.id,
      },
      select: {
        userId: true,
      },
    });

    if (!userRole) {
      throw new ForbiddenException("Organizer access is required");
    }
  }

  private validateMimeType(mimeType: string): string {
    const normalizedMimeType = mimeType.toLowerCase();

    if (!ALLOWED_MIME_TYPES.has(normalizedMimeType)) {
      throw new BadRequestException(
        "Invalid file type. Only JPEG, PNG, and WebP are allowed.",
      );
    }

    return normalizedMimeType;
  }

  private validateExtension(originalname: string): string {
    const extension = extname(originalname).replace(".", "").toLowerCase();

    if (!ALLOWED_EXTENSIONS.has(extension)) {
      throw new BadRequestException(
        "Invalid file extension. Only .jpg, .jpeg, .png, and .webp are allowed.",
      );
    }

    return extension;
  }

  private validateSize(size: number): void {
    if (size > this.maxFileSize) {
      throw new PayloadTooLargeException("Banner file must be 5 MB or smaller");
    }
  }

  private assertMimeTypeMatchesExtension(
    mimeType: string,
    extension: string,
  ): void {
    if (!MIME_TYPES_BY_EXTENSION[extension]?.includes(mimeType)) {
      throw new BadRequestException(
        "File extension does not match the uploaded file type.",
      );
    }
  }
}
