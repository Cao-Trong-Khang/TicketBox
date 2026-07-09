import {
  Controller,
  Get,
  Param,
  Res,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Response } from "express";
import { getBannersConfig } from "../../config/app.config";
import { BannerDownloadService } from "./banner-download.service";

@Controller("uploads/banners")
export class BannersDownloadController {
  private readonly cacheMaxAge: number;

  constructor(
    private readonly bannerDownloadService: BannerDownloadService,
    configService: ConfigService,
  ) {
    this.cacheMaxAge = getBannersConfig(configService).cacheMaxAge;
  }

  @Get(":filename")
  async getBanner(
    @Param("filename") filename: string,
    @Res() response: Response,
  ): Promise<void> {
    const { buffer, mimeType } =
      await this.bannerDownloadService.getPublicBanner(filename);

    response.setHeader("Content-Type", mimeType);
    response.setHeader("Content-Length", buffer.length);
    response.setHeader(
      "Cache-Control",
      `public, max-age=${this.cacheMaxAge}`,
    );
    response.status(200).send(buffer);
  }
}
