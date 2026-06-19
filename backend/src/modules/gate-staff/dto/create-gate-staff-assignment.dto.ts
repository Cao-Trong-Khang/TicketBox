import { IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export class CreateGateStaffAssignmentDto {
  @IsUUID()
  user_id!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(120)
  gate_label!: string;
}
