import { Controller, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Post, Put, Req, UploadedFile, UseFilters, UseGuards, UseInterceptors, Body } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AuthenticatedUser } from '../auth/types';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Permissions } from '../rbac/permissions.decorator';
import { PermissionsGuard } from '../rbac/permissions.guard';
import { PERMISSION_CODES } from '../rbac/rbac.constants';
import { ArtistBioHttpExceptionFilter } from './artist-bio-http-exception.filter';
import { PDF_MAX_BYTES } from './artist-bio.types';
import { ArtistDocumentsService } from './artist-documents.service';
import { UpdateArtistBioDto } from './dto/update-artist-bio.dto';

type AuthenticatedRequest = { user: AuthenticatedUser };
type UploadedPdf = { originalname: string; mimetype: string; size: number; buffer: Buffer };

@Controller('admin/concerts/:concertId/documents')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@UseFilters(ArtistBioHttpExceptionFilter)
@Permissions(PERMISSION_CODES.concertUpdate)
export class ArtistDocumentsController {
  constructor(private readonly service: ArtistDocumentsService) {}

  @Post()
  @HttpCode(HttpStatus.ACCEPTED)
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: PDF_MAX_BYTES } }))
  upload(@Req() req: AuthenticatedRequest, @Param('concertId', new ParseUUIDPipe({ version: '4' })) concertId: string, @UploadedFile() file?: UploadedPdf) {
    return this.service.upload(req.user, concertId, file);
  }

  @Get()
  list(@Req() req: AuthenticatedRequest, @Param('concertId', new ParseUUIDPipe({ version: '4' })) concertId: string) {
    return this.service.list(req.user, concertId);
  }

  @Get(':documentId')
  detail(@Req() req: AuthenticatedRequest, @Param('concertId', new ParseUUIDPipe({ version: '4' })) concertId: string, @Param('documentId', new ParseUUIDPipe({ version: '4' })) documentId: string) {
    return this.service.detail(req.user, concertId, documentId);
  }

  @Put(':documentId/bio')
  updateBio(@Req() req: AuthenticatedRequest, @Param('concertId', new ParseUUIDPipe({ version: '4' })) concertId: string, @Param('documentId', new ParseUUIDPipe({ version: '4' })) documentId: string, @Body() body: UpdateArtistBioDto) {
    return this.service.updateBio(req.user, concertId, documentId, body.generated_bio);
  }

  @Post(':documentId/regenerate')
  @HttpCode(HttpStatus.ACCEPTED)
  regenerate(@Req() req: AuthenticatedRequest, @Param('concertId', new ParseUUIDPipe({ version: '4' })) concertId: string, @Param('documentId', new ParseUUIDPipe({ version: '4' })) documentId: string) {
    return this.service.regenerate(req.user, concertId, documentId);
  }
}
