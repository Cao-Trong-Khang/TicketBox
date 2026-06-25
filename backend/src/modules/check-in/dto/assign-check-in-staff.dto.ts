import { IsString, MaxLength, MinLength } from 'class-validator';

export class AssignCheckInStaffDto {
  @IsString()
  @MinLength(1)
  user_id!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(100)
  gate_label!: string;
}