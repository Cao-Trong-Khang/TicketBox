import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';
import { ReservationReleaseService } from './reservation-release.service';

@Injectable()
export class OrderExpirationService {
  private readonly logger = new Logger(OrderExpirationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly releases: ReservationReleaseService,
  ) {}

  @Cron('*/60 * * * * *')
  async expireOverdueOrders(): Promise<void> {
    try {
      const candidates = await this.prisma.order.findMany({
        where: { status: 'PENDING', expiresAt: { lte: new Date() } },
        orderBy: { expiresAt: 'asc' },
        take: 100,
      });
      let expired = 0;
      let skipped = 0;
      let failed = 0;
      for (const order of candidates) {
        try {
          const result = await this.prisma.$transaction((tx) =>
            this.releases.releasePending(tx, order.id, 'EXPIRED'),
          );
          if (result.released) {
            expired += 1;
            await this.releases.invalidateAvailability(result.concertId);
          } else skipped += 1;
        } catch (error) {
          failed += 1;
          this.logger.warn('Failed to expire order ' + order.id + ': ' + String(error));
        }
      }
      this.logger.log(
        'Expiration job completed: ' + candidates.length + ' candidates, ' +
        expired + ' expired, ' + skipped + ' skipped, ' + failed + ' failed',
      );
    } catch (error) {
      this.logger.error('Expiration job failed', error);
    }
  }
}
