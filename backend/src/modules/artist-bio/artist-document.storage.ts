import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Client } from 'minio';
import { Readable } from 'node:stream';
import { getArtistBioConfig } from '../../config/app.config';

export class StorageTimeoutError extends Error {}

@Injectable()
export class ArtistDocumentStorage implements OnModuleDestroy {
  private readonly client: Client;
  private readonly bucket: string;
  private readonly timeoutMs: number;

  constructor(configService: ConfigService) {
    const config = getArtistBioConfig(configService);
    this.bucket = config.minioBucket;
    this.timeoutMs = config.minioTimeoutMs;
    this.client = new Client({
      endPoint: config.minioEndpoint,
      port: config.minioPort,
      useSSL: config.minioUseSsl,
      accessKey: config.minioAccessKey,
      secretKey: config.minioSecretKey,
    });
  }

  buildStorageKey(concertId: string, documentId: string): string {
    return `artist-documents/${concertId}/${documentId}.pdf`;
  }

  upload(key: string, data: Buffer): Promise<void> {
    return this.withTimeout(
      this.client.putObject(this.bucket, key, data, data.length, { 'Content-Type': 'application/pdf' }).then(() => undefined),
    );
  }

  async download(key: string): Promise<Buffer> {
    const stream = await this.withTimeout(this.client.getObject(this.bucket, key));
    return this.withTimeout(this.streamToBuffer(stream));
  }

  async remove(key: string): Promise<void> {
    await this.withTimeout(this.client.removeObject(this.bucket, key));
  }

  onModuleDestroy(): void {
    // MinIO client owns no persistent connection that requires explicit shutdown.
  }

  private async streamToBuffer(stream: Readable): Promise<Buffer> {
    const chunks: Buffer[] = [];
    for await (const chunk of stream) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    return Buffer.concat(chunks);
  }

  private async withTimeout<T>(operation: Promise<T>): Promise<T> {
    let timer: NodeJS.Timeout | undefined;
    try {
      return await Promise.race([
        operation,
        new Promise<T>((_, reject) => {
          timer = setTimeout(() => reject(new StorageTimeoutError('Object storage request timed out')), this.timeoutMs);
        }),
      ]);
    } finally {
      if (timer) clearTimeout(timer);
    }
  }
}
