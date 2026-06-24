import {
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
  ValidateIf,
} from "class-validator";

export class OrganizerTicketTypeUpdateDto {
  @ValidateIf((_, value) => value !== undefined)
  @IsString()
  @IsNotEmpty()
  code?: string;

  @ValidateIf((_, value) => value !== undefined)
  @IsString()
  @IsNotEmpty()
  name?: string;

  @ValidateIf((_, value) => value !== undefined)
  @IsInt()
  @Min(0)
  priceVnd?: number;

  @ValidateIf((_, value) => value !== undefined)
  @IsInt()
  @Min(1)
  totalQuantity?: number;

  @ValidateIf((_, value) => value !== undefined)
  @IsInt()
  @Min(1)
  perUserLimit?: number;

  @IsOptional()
  @IsDateString()
  saleStartAt?: string;

  @IsOptional()
  @IsDateString()
  saleEndAt?: string | null;
}
