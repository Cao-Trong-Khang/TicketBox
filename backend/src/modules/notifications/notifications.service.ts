import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { NotificationFactory } from './notification.factory';
import type {
  SendNotificationRequest,
  SendNotificationResponse,
  NotificationChannelName,
} from './notification.types';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(private readonly notificationFactory: NotificationFactory) {}

  async send(
    request: SendNotificationRequest,
    channels: NotificationChannelName[],
  ): Promise<SendNotificationResponse[]> {
    this.validateRequest(request);

    const results: SendNotificationResponse[] = [];

    for (const channelName of channels) {
      try {
        const provider = this.notificationFactory.getProvider(channelName);
        this.logger.log(
          `Sending ${channelName} notification: type=${request.type}, userId=${request.userId}`,
        );
        const response = await provider.send(request);
        this.logger.log(
          `Notification sent: messageId=${response.messageId}, channel=${channelName}`,
        );
        results.push(response);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        this.logger.error(
          `Failed to send ${channelName} notification: ${errorMessage}`,
        );
        results.push({
          messageId: '',
          channel: channelName,
          status: 'failed',
          rawPayload: { error: errorMessage },
        });
      }
    }

    return results;
  }

  listChannels(): NotificationChannelName[] {
    return this.notificationFactory.listChannels();
  }

  private validateRequest(request: SendNotificationRequest): void {
    if (!request.userId || typeof request.userId !== 'string') {
      throw new BadRequestException('userId is required and must be a string');
    }

    if (!request.type || typeof request.type !== 'string') {
      throw new BadRequestException('type is required and must be a string');
    }

    if (!request.data || typeof request.data !== 'object') {
      throw new BadRequestException('data is required and must be an object');
    }
  }
}
