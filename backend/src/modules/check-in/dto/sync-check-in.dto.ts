import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsISO8601,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';

export enum CheckInScanEntityType {
  ticket = 'ticket',
  vipGuest = 'vip_guest',
  unknown = 'unknown',
}

export enum CheckInClientMode {
  online = 'online',
  offline = 'offline',
}

export class CheckInSyncScanDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  localScanId!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(1024)
  qrHash!: string;

  @IsEnum(CheckInScanEntityType)
  entityType!: CheckInScanEntityType;

  @IsISO8601()
  scannedAt!: string;

  @IsOptional()
  @IsEnum(CheckInClientMode)
  mode?: CheckInClientMode;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  localResult?: string;
}

export class SyncCheckInDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  sourceDeviceId!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => CheckInSyncScanDto)
  scans!: CheckInSyncScanDto[];
}
