import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { AiArtistBioStatus, ArtistDocumentStatus, ConcertStatus } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthenticatedUser } from '../auth/types';
import { PermissionService } from '../rbac/permission.service';
import { PERMISSION_CODES, ROLE_CODES } from '../rbac/rbac.constants';
import { RedisCacheService } from '../redis-cache/redis-cache.service';
import { ArtistBioJobsPublisher } from './artist-bio-jobs.publisher';
import { ArtistDocumentStorage } from './artist-document.storage';
import { ArtistDocumentDetailDto, ArtistDocumentListItemDto, PDF_MAX_BYTES } from './artist-bio.types';
import { PdfTextExtractor } from './pdf-text-extractor';

type UploadedPdf = { originalname: string; mimetype: string; size: number; buffer: Buffer };

@Injectable()
export class ArtistDocumentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly permissionService: PermissionService,
    private readonly storage: ArtistDocumentStorage,
    private readonly publisher: ArtistBioJobsPublisher,
    private readonly pdfExtractor: PdfTextExtractor,
    private readonly redis: RedisCacheService,
  ) {}

  async upload(user: AuthenticatedUser, concertId: string, file?: UploadedPdf): Promise<{ document_id: string; status: 'uploaded' }> {
    await this.assertOwner(user.id, concertId, true);
    if (!file) throw new BadRequestException('PDF file is required');
    if (file.size > PDF_MAX_BYTES) throw new BadRequestException('PDF must not exceed 10 MB');

    const fileName = decodeUploadedFileName(file.originalname);
    this.pdfExtractor.assertValidPdf(fileName, file.mimetype, file.buffer);

    const documentId = randomUUID();
    const storageKey = this.storage.buildStorageKey(concertId, documentId);
    await this.storage.upload(storageKey, file.buffer);
    try {
      await this.prisma.artistDocument.create({ data: { id: documentId, concertId, fileName, storageKey } });
    } catch (error) {
      await this.storage.remove(storageKey).catch(() => undefined);
      throw error;
    }

    try {
      await this.publisher.publish({ document_id: documentId, concert_id: concertId, storage_key: storageKey, attempt: 1 });
    } catch {
      throw new ServiceUnavailableException('Biography job could not be queued; the upload remains available for retry');
    }
    return { document_id: documentId, status: 'uploaded' };
  }

  async list(user: AuthenticatedUser, concertId: string): Promise<ArtistDocumentListItemDto[]> {
    await this.assertOwner(user.id, concertId);
    const documents = await this.prisma.artistDocument.findMany({ where: { concertId }, orderBy: { createdAt: 'desc' } });
    return documents.map((document) => ({ document_id: document.id, file_name: document.fileName, status: document.status.toLowerCase(), uploaded_at: document.uploadedAt.toISOString() }));
  }

  async detail(user: AuthenticatedUser, concertId: string, documentId: string): Promise<ArtistDocumentDetailDto> {
    await this.assertOwner(user.id, concertId);
    const document = await this.findDocument(concertId, documentId);
    return {
      document_id: document.id,
      file_name: document.fileName,
      status: document.status.toLowerCase(),
      uploaded_at: document.uploadedAt.toISOString(),
      ...(document.extractedText ? { extracted_text: document.extractedText } : {}),
      ...(document.bio?.generatedBio ? { generated_bio: document.bio.generatedBio } : {}),
      ...(document.bio?.failureReason ? { failure_reason: document.bio.failureReason } : {}),
      ...(document.bio?.generatedAt ? { generated_at: document.bio.generatedAt.toISOString() } : {}),
    };
  }

  async updateBio(user: AuthenticatedUser, concertId: string, documentId: string, generatedBio: string): Promise<{ generated_bio: string }> {
    await this.assertOwner(user.id, concertId, true);
    const document = await this.findDocument(concertId, documentId);
    if (!document.bio) throw new ConflictException('No generated biography exists for this document');
    const value = generatedBio.trim();
    if (!value) throw new BadRequestException('generated_bio must not be empty');
    const now = new Date();
    await this.prisma.$transaction([
      this.prisma.aiArtistBio.update({ where: { documentId }, data: { generatedBio: value, failureReason: null, status: AiArtistBioStatus.DONE, generatedAt: now } }),
      this.prisma.artistDocument.update({ where: { id: documentId }, data: { status: ArtistDocumentStatus.DONE } }),
      this.prisma.auditLog.create({ data: { actorUserId: user.id, entityType: 'ai_artist_bio', entityId: document.bio.id, action: 'MANUAL_BIO_OVERRIDE', metadata: { concertId, documentId } } }),
    ]);
    await this.redis.del(`concerts:detail:${concertId}`);
    return { generated_bio: value };
  }

  async regenerate(user: AuthenticatedUser, concertId: string, documentId: string): Promise<{ document_id: string; status: 'uploaded' }> {
    await this.assertOwner(user.id, concertId, true);
    const source = await this.findDocument(concertId, documentId);
    const newId = randomUUID();
    await this.prisma.artistDocument.create({ data: { id: newId, concertId, fileName: source.fileName, storageKey: source.storageKey } });
    try {
      await this.publisher.publish({ document_id: newId, concert_id: concertId, storage_key: source.storageKey, attempt: 1 });
    } catch {
      throw new ServiceUnavailableException('Biography regeneration could not be queued; the attempt remains available for retry');
    }
    return { document_id: newId, status: 'uploaded' };
  }

  private async findDocument(concertId: string, documentId: string) {
    const document = await this.prisma.artistDocument.findFirst({ where: { id: documentId, concertId }, include: { bio: true } });
    if (!document) throw new NotFoundException('Artist document not found');
    return document;
  }

  private async assertOwner(userId: string, concertId: string, requireEditable = false): Promise<void> {
    const [roles, permitted, concert] = await Promise.all([
      this.prisma.userRole.findMany({ where: { userId }, include: { role: true } }),
      this.permissionService.userHasPermissions(userId, [PERMISSION_CODES.concertUpdate]),
      this.prisma.concert.findUnique({
        where: { id: concertId },
        select: { organizerId: true, status: true, startsAt: true, performanceStartAt: true },
      }),
    ]);
    if (!concert) throw new NotFoundException('Concert not found');
    const organizer = roles.some(({ role }) => role.code === ROLE_CODES.organizer);
    if (!organizer || !permitted || concert.organizerId !== userId) throw new ForbiddenException('Organizer ownership and concert management permission are required');
    const performanceStartAt = concert.performanceStartAt ?? concert.startsAt;
    if (requireEditable && (concert.status === ConcertStatus.CANCELLED || performanceStartAt.getTime() <= Date.now())) {
      throw new ConflictException('Artist biography cannot be changed for a cancelled, ongoing, or ended concert');
    }
  }
}

function decodeUploadedFileName(fileName: string): string {
  const decoded = Buffer.from(fileName, 'latin1').toString('utf8');
  return decoded.includes('\uFFFD') ? fileName : decoded;
}
