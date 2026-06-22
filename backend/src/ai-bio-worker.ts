import { NestFactory } from '@nestjs/core';
import { ArtistBioWorkerModule } from './ai-bio-worker.module';
import { ArtistBioWorkerService } from './modules/artist-bio/artist-bio-worker.service';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(ArtistBioWorkerModule);
  const worker = app.get(ArtistBioWorkerService);
  await worker.run();
}

void bootstrap();
