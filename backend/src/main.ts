import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { getHttpConfig } from './config/app.config';
import { HttpErrorFilter } from './http-error.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);
  const httpConfig = getHttpConfig(configService);

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
  app.useGlobalFilters(new HttpErrorFilter());

  await app.listen(httpConfig.port);
}

void bootstrap();
