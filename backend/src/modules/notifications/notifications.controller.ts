import { Controller, Post, Body, HttpCode, HttpStatus, Logger } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import type { SendNotificationDto, SendNotificationResponseDto } from './dto/send-notification.dto';

@Controller('notifications')
export class NotificationsController {
  private readonly logger = new Logger(NotificationsController.name);

  constructor(private readonly notificationsService: NotificationsService) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  async send(@Body() dto: SendNotificationDto): Promise<SendNotificationResponseDto> {
    const channels = dto.channels ?? this.notificationsService.listChannels();
    this.logger.log(
      `Received notification request: type=${dto.type}, userId=${dto.userId}, channels=${channels.join(',')}`,
    );

    const results = await this.notificationsService.send(
      {
        userId: dto.userId,
        type: dto.type,
        data: dto.data,
      },
      channels,
    );

    return { results };
  }
}
