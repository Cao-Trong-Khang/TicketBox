import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { HttpErrorFormatFilter } from './common/filters/http-error-format.filter';
import { getHttpConfig } from './config/app.config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);
  const httpConfig = getHttpConfig(configService);

  app.enableCors({
    origin: httpConfig.frontendOrigins,
    credentials: true,
  });
  app.useGlobalFilters(new HttpErrorFormatFilter());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );

  await app.listen(httpConfig.port, '0.0.0.0');
}

void bootstrap();
