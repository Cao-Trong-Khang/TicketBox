import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ArtistBioModule } from './modules/artist-bio/artist-bio.module';

@Module({ imports: [ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: process.env.DOCKER_RUNTIME === 'true', envFilePath: ['.env', '../.env'] }), ArtistBioModule] })
export class ArtistBioWorkerModule {}
