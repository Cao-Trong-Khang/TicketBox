import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { RbacModule } from '../rbac/rbac.module';
import { RedisCacheModule } from '../redis-cache/redis-cache.module';
import { ArtistBioAiProvider } from './artist-bio-ai.provider';
import { ArtistBioJobsPublisher } from './artist-bio-jobs.publisher';
import { ArtistBioWorkerService } from './artist-bio-worker.service';
import { ArtistBioPreviewController } from './artist-bio-preview.controller';
import { ArtistBioPreviewService } from './artist-bio-preview.service';
import { ArtistDocumentStorage } from './artist-document.storage';
import { ArtistDocumentsController } from './artist-documents.controller';
import { ArtistDocumentsService } from './artist-documents.service';
import { PdfTextExtractor } from './pdf-text-extractor';

@Module({
  imports: [PrismaModule, RedisCacheModule, RbacModule],
  controllers: [ArtistDocumentsController, ArtistBioPreviewController],
  providers: [ArtistDocumentsService, ArtistBioPreviewService, ArtistDocumentStorage, ArtistBioJobsPublisher, PdfTextExtractor, ArtistBioAiProvider, ArtistBioWorkerService],
  exports: [ArtistBioWorkerService, ArtistBioJobsPublisher],
})
export class ArtistBioModule {}
