import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

type BannerFileRow = {
  data: Buffer | Uint8Array;
  mime_type: string;
};

@Injectable()
export class BannerDatabaseStorageService {
  private ensureTablePromise: Promise<void> | null = null;

  constructor(private readonly prisma: PrismaService) {}

  async upload(
    filename: string,
    data: Buffer,
    mimeType: string,
  ): Promise<void> {
    await this.ensureTable();
    await this.prisma.$executeRaw`
      INSERT INTO banner_files (filename, mime_type, data)
      VALUES (${filename}, ${mimeType}, ${data})
      ON CONFLICT (filename) DO UPDATE
      SET mime_type = EXCLUDED.mime_type,
          data = EXCLUDED.data,
          created_at = NOW()
    `;
  }

  async download(
    filename: string,
  ): Promise<{ buffer: Buffer; mimeType: string } | null> {
    await this.ensureTable();
    const rows = await this.prisma.$queryRaw<BannerFileRow[]>`
      SELECT mime_type, data
      FROM banner_files
      WHERE filename = ${filename}
      LIMIT 1
    `;
    const row = rows[0];

    if (!row) {
      return null;
    }

    return {
      buffer: Buffer.from(row.data),
      mimeType: row.mime_type,
    };
  }

  private async ensureTable(): Promise<void> {
    this.ensureTablePromise ??= this.prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS banner_files (
        filename TEXT PRIMARY KEY,
        mime_type TEXT NOT NULL,
        data BYTEA NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `).then(() => undefined);

    return this.ensureTablePromise;
  }
}
