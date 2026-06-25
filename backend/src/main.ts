import { ConfigService } from '@nestjs/config';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { getCheckInQrConfig, getHttpConfig } from './config/app.config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);
  const httpConfig = getHttpConfig(configService);

  getCheckInQrConfig(configService);

  app.enableCors({
    origin: httpConfig.frontendOrigins,
    credentials: true,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );

  await app.listen(httpConfig.port, '0.0.0.0');
}

void bootstrap();

