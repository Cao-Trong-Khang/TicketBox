import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  getHttpConfig,
  getKafkaConfig,
  getPostgresConfig,
  getRedisConfig,
} from '../../shared/config/app.config';

@Injectable()
export class HealthService {
  constructor(private readonly configService: ConfigService) {}

  getHealth() {
    const http = getHttpConfig(this.configService);
    const postgres = getPostgresConfig(this.configService);
    const redis = getRedisConfig(this.configService);
    const kafka = getKafkaConfig(this.configService);

    return {
      service: 'TicketBox API',
      status: 'ok',
      environment: this.configService.get<string>('NODE_ENV', 'development'),
      timestamp: new Date().toISOString(),
      http: {
        port: http.port,
        frontendOrigins: http.frontendOrigins,
      },
      dependencies: {
        postgres: {
          configured: Boolean(postgres.host && postgres.database),
          host: postgres.host,
          port: postgres.port,
          database: postgres.database,
        },
        redis: {
          configured: Boolean(redis.host),
          host: redis.host,
          port: redis.port,
        },
        kafka: {
          configured: kafka.brokers.length > 0,
          brokers: kafka.brokers,
        },
      },
    };
  }
}
