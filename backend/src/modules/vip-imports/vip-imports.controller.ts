import { Controller, Get, Param, ParseUUIDPipe, Req, UseGuards } from '@nestjs/common';
import { AuthenticatedUser } from '../auth/types';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Permissions } from '../rbac/permissions.decorator';
import { PermissionsGuard } from '../rbac/permissions.guard';
import { PERMISSION_CODES } from '../rbac/rbac.constants';
import { VipImportReportService } from './vip-import-report.service';
import { VipImportDetailDto, VipImportListItemDto } from './vip-imports.types';

type AuthenticatedRequest = {
  user: AuthenticatedUser;
};

@Controller('admin/concerts/:concertId/vip-imports')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class VipImportsController {
  constructor(private readonly vipImportReportService: VipImportReportService) {}

  @Get()
  @Permissions(PERMISSION_CODES.concertUpdate)
  listImports(
    @Req() request: AuthenticatedRequest,
    @Param('concertId', new ParseUUIDPipe({ version: '4' })) concertId: string,
  ): Promise<VipImportListItemDto[]> {
    return this.vipImportReportService.listImportsForConcert(request.user, concertId);
  }

  @Get(':importId')
  @Permissions(PERMISSION_CODES.concertUpdate)
  getImport(
    @Req() request: AuthenticatedRequest,
    @Param('concertId', new ParseUUIDPipe({ version: '4' })) concertId: string,
    @Param('importId', new ParseUUIDPipe({ version: '4' })) importId: string,
  ): Promise<VipImportDetailDto> {
    return this.vipImportReportService.getImportForConcert(request.user, concertId, importId);
  }
}
