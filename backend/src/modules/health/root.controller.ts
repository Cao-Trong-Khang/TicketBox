import { Controller, Get } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Controller()
export class RootController {
  constructor(private readonly configService: ConfigService) {}

  @Get()
  getRoot() {
    return {
      service: 'TicketBox API',
      status: 'ok',
      environment: this.configService.get<string>('NODE_ENV', 'development'),
      endpoints: {
        health: '/health',
        concerts: '/concerts',
        authLogin: '/auth/login',
      },
    };
  }
}
