import { Injectable, OnModuleDestroy } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Client } from "minio";
import { Readable } from "node:stream";
import { getArtistBioConfig, getBannersConfig } from "../../config/app.config";

export class BannerStorageTimeoutError extends Error {}

@Injectable()
export class BannerStorageService implements OnModuleDestroy {
  private readonly client: Client;
  private readonly bucket: string;
  private readonly timeoutMs: number;

  constructor(configService: ConfigService) {
    const artistBioConfig = getArtistBioConfig(configService);
    const bannersConfig = getBannersConfig(configService);

    this.bucket = bannersConfig.bucket;
    this.timeoutMs = artistBioConfig.minioTimeoutMs;
    this.client = new Client({
      endPoint: artistBioConfig.minioEndpoint,
      port: artistBioConfig.minioPort,
      useSSL: artistBioConfig.minioUseSsl,
      accessKey: artistBioConfig.minioAccessKey,
      secretKey: artistBioConfig.minioSecretKey,
    });
  }

  upload(key: string, data: Buffer, mimeType: string): Promise<void> {
    return this.withTimeout(
      this.client
        .putObject(this.bucket, key, data, data.length, {
          "Content-Type": mimeType,
        })
        .then(() => undefined),
    );
  }

  async download(key: string): Promise<Buffer> {
    const stream = await this.withTimeout(this.client.getObject(this.bucket, key));
    return this.withTimeout(this.streamToBuffer(stream));
  }

  onModuleDestroy(): void {
    // MinIO client owns no persistent connection that requires explicit shutdown.
  }

  private async streamToBuffer(stream: Readable): Promise<Buffer> {
    const chunks: Buffer[] = [];

    for await (const chunk of stream) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }

    return Buffer.concat(chunks);
  }

  private async withTimeout<T>(operation: Promise<T>): Promise<T> {
    let timer: NodeJS.Timeout | undefined;

    try {
      return await Promise.race([
        operation,
        new Promise<T>((_, reject) => {
          timer = setTimeout(
            () =>
              reject(
                new BannerStorageTimeoutError(
                  "Banner storage request timed out",
                ),
              ),
            this.timeoutMs,
          );
        }),
      ]);
    } finally {
      if (timer) {
        clearTimeout(timer);
      }
    }
  }
}
