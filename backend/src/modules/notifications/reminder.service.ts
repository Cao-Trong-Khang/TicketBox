import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisCacheService } from '../redis-cache/redis-cache.service';
import { NotificationsService } from './notifications.service';

@Injectable()
export class ReminderService {
  private readonly logger = new Logger(ReminderService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redisCache: RedisCacheService,
    private readonly notificationsService: NotificationsService,
  ) {}

  // Run every hour to check concerts starting in 24 hours
  @Cron('0 * * * *')
  async sendUpcomingEventReminders() {
    try {
      this.logger.log('Starting event reminder job...');
      const now = new Date();
      const twentyFourHoursFromNow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      const twentyFiveHoursFromNow = new Date(now.getTime() + 25 * 60 * 60 * 1000);

      // Query concerts starting between 24 and 25 hours from now
      const upcomingConcerts = await this.prisma.concert.findMany({
        where: {
          startsAt: {
            gte: twentyFourHoursFromNow,
            lte: twentyFiveHoursFromNow,
          },
        },
      });

      this.logger.log(`Found ${upcomingConcerts.length} upcoming concerts starting 24h from now.`);

      for (const concert of upcomingConcerts) {
        const tickets = await this.prisma.ticket.findMany({
          where: {
            concertId: concert.id,
            status: 'ACTIVE',
          },
          include: {
            owner: true,
          },
        });

        for (const ticket of tickets) {
          const cacheKey = `reminder:sent:concert:${concert.id}:user:${ticket.ownerUserId}`;
          const alreadySent = await this.redisCache.get(cacheKey);

          if (alreadySent === 'true') {
            continue;
          }

          this.logger.log(`Sending reminder to user ${ticket.ownerUserId} for concert ${concert.title}`);

          try {
            await this.notificationsService.send(
              {
                userId: ticket.ownerUserId,
                type: 'event_reminder',
                data: {
                  email: ticket.owner.email,
                  concertTitle: concert.title,
                  startsAt: concert.startsAt.toISOString(),
                  venueName: concert.venueName,
                },
              },
              ['email', 'push', 'sms', 'zalo'],
            );

            // Record in cache with 48h TTL
            await this.redisCache.set(cacheKey, 'true', 48 * 60 * 60);
          } catch (err) {
            this.logger.error(`Failed to send reminder for ticket ${ticket.id}:`, err);
          }
        }
      }
      this.logger.log('Event reminder job finished.');
    } catch (err) {
      this.logger.error('Error running event reminder job:', err as any);
    }
  }
}
