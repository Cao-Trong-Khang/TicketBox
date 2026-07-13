import {
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UnauthorizedException,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { AuthenticatedUser } from "../auth/types";
import { Permissions } from "../rbac/permissions.decorator";
import { PermissionsGuard } from "../rbac/permissions.guard";
import { PERMISSION_CODES } from "../rbac/rbac.constants";
import {
  BannerUploadService,
  DEFAULT_BANNER_MAX_FILE_SIZE,
  UploadedBannerFile,
} from "./banner-upload.service";

type AuthenticatedRequest = {
  user?: AuthenticatedUser;
};

@Controller("organizer/concerts/banners")
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Permissions(PERMISSION_CODES.concertCreate)
export class BannersController {
  constructor(private readonly bannerUploadService: BannerUploadService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(
    FileInterceptor("file", {
      limits: { fileSize: DEFAULT_BANNER_MAX_FILE_SIZE },
    }),
  )
  uploadBanner(
    @Req() request: AuthenticatedRequest,
    @UploadedFile() file?: UploadedBannerFile,
  ): Promise<{ bannerUrl: string }> {
    if (!request.user) {
      throw new UnauthorizedException("Authentication is required");
    }

    return this.bannerUploadService.upload(request.user.id, file);
  }
}
