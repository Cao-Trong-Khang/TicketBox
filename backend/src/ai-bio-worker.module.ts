import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ArtistBioModule } from './modules/artist-bio/artist-bio.module';

@Module({ imports: [ConfigModule.forRoot({ isGlobal: true, envFilePath: ['.env'] }), ArtistBioModule] })
export class ArtistBioWorkerModule {}
