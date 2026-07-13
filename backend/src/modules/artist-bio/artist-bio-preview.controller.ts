import { Body, Controller, HttpCode, HttpStatus, Post, UploadedFile, UseFilters, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Permissions } from '../rbac/permissions.decorator';
import { PermissionsGuard } from '../rbac/permissions.guard';
import { PERMISSION_CODES } from '../rbac/rbac.constants';
import { ArtistBioHttpExceptionFilter } from './artist-bio-http-exception.filter';
import { ArtistBioPreviewService } from './artist-bio-preview.service';
import { PDF_MAX_BYTES } from './artist-bio.types';

type UploadedPdf = { originalname: string; mimetype: string; size: number; buffer: Buffer };

@Controller('admin/artist-bio')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@UseFilters(ArtistBioHttpExceptionFilter)
@Permissions(PERMISSION_CODES.concertCreate)
export class ArtistBioPreviewController {
  constructor(private readonly service: ArtistBioPreviewService) {}

  @Post('preview')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: PDF_MAX_BYTES } }))
  preview(@UploadedFile() file?: UploadedPdf, @Body('previous_bio') previousBio?: string) {
    return this.service.generate(file, previousBio);
  }
}
