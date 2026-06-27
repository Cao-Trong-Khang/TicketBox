import {
  IsDateString,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  ValidateIf,
} from "class-validator";

export class OrganizerConcertUpdateDto {
  @ValidateIf((_, value) => value !== undefined)
  @IsString()
  @IsNotEmpty()
  title?: string;

  @ValidateIf((_, value) => value !== undefined)
  @IsString()
  @IsNotEmpty()
  artistName?: string;

  @IsOptional()
  @IsString()
  description?: string | null;

  @ValidateIf((_, value) => value !== undefined)
  @IsString()
  @IsNotEmpty()
  venueName?: string;

  @ValidateIf((_, value) => value !== undefined)
  @IsString()
  @IsNotEmpty()
  venueAddress?: string;

  @IsOptional()
  @IsUrl()
  bannerUrl?: string | null;

  @IsOptional()
  @IsString()
  seatingSvg?: string | null;

  @ValidateIf((_, value) => value !== undefined)
  @IsDateString()
  startsAt?: string;

  @ValidateIf((_, value) => value !== undefined)
  @IsDateString()
  endsAt?: string;
}
