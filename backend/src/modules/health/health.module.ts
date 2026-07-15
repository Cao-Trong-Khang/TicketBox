import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';
import { RootController } from './root.controller';

@Module({
  controllers: [HealthController, RootController],
  providers: [HealthService],
})
export class HealthModule {}
