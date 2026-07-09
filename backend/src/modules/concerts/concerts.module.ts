import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { RateLimitModule } from "../rate-limit/rate-limit.module";
import { RedisCacheModule } from "../redis-cache/redis-cache.module";
import { ConcertsController } from "./concerts.controller";
import { ConcertsService } from "./concerts.service";
import { BannerDownloadService } from "./banner-download.service";
import { BannerStorageService } from "./banner-storage.service";
import { BannerUploadService } from "./banner-upload.service";
import { BannersController } from "./banners.controller";
import { BannersDownloadController } from "./banners-download.controller";
import { OrganizerConcertsController } from "./organizer-concerts.controller";
import { OrganizerConcertsService } from "./organizer-concerts.service";
import { OrganizerTicketTypesController } from "./organizer-ticket-types.controller";
import { OrganizerTicketTypesService } from "./organizer-ticket-types.service";

@Module({
  imports: [AuthModule, RedisCacheModule, RateLimitModule],
  controllers: [
    ConcertsController,
    OrganizerConcertsController,
    OrganizerTicketTypesController,
    BannersController,
    BannersDownloadController,
  ],
  providers: [
    ConcertsService,
    OrganizerConcertsService,
    OrganizerTicketTypesService,
    BannerStorageService,
    BannerUploadService,
    BannerDownloadService,
  ],
})
export class ConcertsModule {}
