import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class UpdateArtistBioDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(10000)
  generated_bio!: string;
}
