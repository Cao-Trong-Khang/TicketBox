import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { NotificationFactory } from './notification.factory';
import { EmailProvider } from './providers/email.provider';
import { PushProvider } from './providers/push.provider';
import { CircuitBreaker } from '../../shared/circuit-breaker/circuit-breaker';
import { getNotificationConfig } from '../../shared/config/app.config';

@Module({
  controllers: [NotificationsController],
  providers: [
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
        ]);

        return new NotificationsService(factory);
      },
      inject: [ConfigService],
    },
  ],
})
export class NotificationsModule {}
