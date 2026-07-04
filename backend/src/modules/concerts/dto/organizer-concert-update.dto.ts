import {
  IsDateString,
  IsNotEmpty,
  IsOptional,
  IsString,
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
  @IsString()
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

  @ValidateIf((_, value) => value !== undefined)
  @IsDateString()
  performanceStartAt?: string;
}
