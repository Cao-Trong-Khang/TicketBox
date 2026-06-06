import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { getHttpConfig } from './shared/config/app.config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);
  const httpConfig = getHttpConfig(configService);

  app.enableCors({
    origin: httpConfig.frontendOrigins,
    credentials: true,
  });

  await app.listen(httpConfig.port);
}

void bootstrap();
