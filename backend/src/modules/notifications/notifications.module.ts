import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { ReminderService } from './reminder.service';
import { NotificationFactory } from './notification.factory';
import { EmailProvider } from './providers/email.provider';
import { PushProvider } from './providers/push.provider';
import { SmsProvider } from './providers/sms.provider';
import { ZaloProvider } from './providers/zalo.provider';
import { CircuitBreaker } from '../../shared/circuit-breaker/circuit-breaker';
import { getNotificationConfig } from '../../config/app.config';

@Module({
  controllers: [NotificationsController],
  providers: [
    ReminderService,
    {
      provide: NotificationsService,
      useFactory: (configService: ConfigService) => {
        const notificationConfig = getNotificationConfig(configService);

        const factory = new NotificationFactory([
          new EmailProvider({
            circuitBreaker: new CircuitBreaker({
              failureThreshold: 3,
              resetTimeoutMs: 30000,
              halfOpenSuccessThreshold: 2,
            }),
            config: notificationConfig.email,
          }),
          new PushProvider({
            circuitBreaker: new CircuitBreaker({
              failureThreshold: 3,
              resetTimeoutMs: 30000,
              halfOpenSuccessThreshold: 2,
            }),
            config: notificationConfig.push,
          }),
          new SmsProvider({
            circuitBreaker: new CircuitBreaker({
              failureThreshold: 3,
              resetTimeoutMs: 30000,
              halfOpenSuccessThreshold: 2,
            }),
          }),
          new ZaloProvider({
            circuitBreaker: new CircuitBreaker({
              failureThreshold: 3,
              resetTimeoutMs: 30000,
              halfOpenSuccessThreshold: 2,
            }),
          }),
        ]);

        return new NotificationsService(factory);
      },
      inject: [ConfigService],
    },
  ],
  exports: [NotificationsService],
})
export class NotificationsModule {}
